<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
use App\Models\Notification;
use App\Models\Order;
use App\Models\Product;
use App\Models\Queue;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->Role === 'customer', 403);
        $data = $request->validate([
            'items' => ['nullable', 'array', 'min:1', 'required_without:customItems'],
            'items.*.ProductID' => ['required_with:items', 'integer', 'distinct', 'exists:Product,ProductID'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1', 'max:99'],
            'customItems' => ['nullable', 'array', 'min:1', 'required_without:items'],
            'customItems.*.name' => ['required_with:customItems', 'string', 'max:255'],
            'customItems.*.quantity' => ['required_with:customItems', 'integer', 'min:1', 'max:99'],
            'customItems.*.price' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'source' => ['nullable', 'string', 'max:150'],
            'label' => ['nullable', 'string', 'max:255'],
            'section' => ['nullable', Rule::in(['food', 'item'])],
            // Stored in the JSON snapshot, not trusted for any business
            // decision. It lets the customer browser reconcile its local
            // card with this authoritative record even if the asynchronous
            // OrderID patch is interrupted.
            'clientOrderId' => ['nullable', 'string', 'max:100'],
            'deliveryAddress' => ['required', 'string', 'max:2000'],
            'serviceFee' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        $order = DB::transaction(function () use ($data, $request) {
            $serviceFee = (float) ($data['serviceFee'] ?? 0);
            if (!empty($data['customItems'])) {
                $itemsTotal = collect($data['customItems'])->sum(fn ($item) => (float) ($item['price'] ?? 0) * $item['quantity']);
                return Order::create([
                    'UserID' => $request->user()->UserID,
                    'TotalPrice' => $itemsTotal + $serviceFee,
                    'ServiceFee' => $serviceFee,
                    'OrderDate' => now(),
                    'DeliveryAddress' => $data['deliveryAddress'],
                    'OrderSnapshot' => [
                        'source' => $data['source'] ?? 'Otu-Zan',
                        'label' => $data['label'] ?? 'Customer order',
                        'section' => $data['section'] ?? 'food',
                        'clientOrderId' => $data['clientOrderId'] ?? null,
                        'items' => $data['customItems'],
                    ],
                    'DeliveryStatus' => 'pending_rider',
                ]);
            }
            $productIds = collect($data['items'])->pluck('ProductID');
            $products = Product::whereIn('ProductID', $productIds)->where('IsActive', true)->get()->keyBy('ProductID');

            $itemsTotal = 0;
            $lineItems = [];
            foreach ($data['items'] as $item) {
                $product = $products->get($item['ProductID']);
                abort_unless($product, 422, 'One or more items are no longer available.');
                $itemsTotal += $product->ProductPrice * $item['quantity'];
                $lineItems[] = [
                    'ProductID' => $product->ProductID,
                    'OrderItemPrice' => $product->ProductPrice,
                    'ProductQuantity' => $item['quantity'],
                ];
            }

            $order = Order::create([
                'UserID' => $request->user()->UserID,
                'TotalPrice' => $itemsTotal + $serviceFee,
                'ServiceFee' => $serviceFee,
                'OrderDate' => now(),
                'DeliveryAddress' => $data['deliveryAddress'],
                'OrderSnapshot' => ['clientOrderId' => $data['clientOrderId'] ?? null],
                'DeliveryStatus' => 'pending_rider',
            ]);
            foreach ($lineItems as $lineItem) {
                $order->items()->create($lineItem);
            }

            return $order;
        });

        return response()->json(['order' => $order->load('items.product')], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        // 'user'/'rider'/brand chain: not just for display - this is the data
        // a rider synthesizes a full order card from when this order was
        // placed on a customer's own device and never touched this rider's
        // local storage (see useBackendOrders.js's toLocalOrderShape).
        $query = Order::query()->with(['items.product.brand.service', 'payments', 'user', 'rider'])->orderByDesc('OrderDate');

        if ($user->Role === 'driver') {
            $query->where('AssignedRiderID', $user->UserID);
        } else {
            $query->where('UserID', $user->UserID);
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        $paginated = $query->paginate($perPage);
        $this->attachQueuePositions($paginated);
        return response()->json($paginated);
    }

    public function indexAll(Request $request): JsonResponse
    {
        $query = Order::query()->with(['items.product.brand.service', 'user', 'rider', 'payments'])->orderByDesc('OrderDate');
        // Comma-separated so the History tab can ask for delivered+cancelled
        // in one request instead of two - a single status still works
        // exactly as before.
        $status = $request->query('status');
        if ($status) $query->whereIn('DeliveryStatus', explode(',', $status));

        // Exact-date filter (Y-m-d, Asia/Manila business calendar day - same
        // convention as revenue()). OrderDate is stored UTC, so the day's
        // boundaries are converted back to UTC before filtering rather than
        // comparing the stored value against a naive date string.
        $date = $request->query('date');
        if ($date) {
            $dayStart = Carbon::createFromFormat('Y-m-d', $date, 'Asia/Manila')->startOfDay()->setTimezone('UTC');
            $dayEnd = (clone $dayStart)->addDay();
            $query->where('OrderDate', '>=', $dayStart)->where('OrderDate', '<', $dayEnd);
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        $paginated = $query->paginate($perPage);
        $this->attachQueuePositions($paginated);
        return response()->json($paginated);
    }

    // Computes revenue directly from every non-cancelled order in the table,
    // not from whatever page the admin dashboard happens to have loaded -
    // indexAll()/the frontend used to derive "total revenue" by summing the
    // capped, paginated order list it already had for display, so once order
    // volume passed the 50-per-page cap, older orders silently fell out of
    // the total. Revenue is the ServiceFee column (the delivery/service
    // charge Otu-Zan actually earns), matching what the dashboard already
    // showed - never the item subtotal or a bill's pass-through amount.
    // Calendar-day bucketing uses Asia/Manila (UTC+8) since OrderDate is
    // stored in UTC (config('app.timezone')) - a raw UTC-midnight boundary
    // would flip an order into "yesterday" mid-afternoon local time.
    // Optional ?date=Y-m-d (Asia/Manila) narrows total/byService/orderCount to
    // that single calendar day - `daily` always covers every day on record
    // regardless of the filter, since that's the series the Revenue tab's
    // line graph plots and narrowing it would defeat the point of a trend
    // chart.
    public function revenue(Request $request): JsonResponse
    {
        $timezone = 'Asia/Manila';
        $requestedDate = $request->query('date');

        $orders = Order::with(['items.product.brand.service', 'payments'])
            ->where('DeliveryStatus', '!=', 'cancelled')
            ->get();

        $daily = [];
        $byService = ['food' => 0.0, 'item' => 0.0, 'bills' => 0.0];
        $total = 0.0;
        $orderCount = 0;
        // Peak ordering time (Layer 1 analytics) - always all-time, same as
        // $daily above, since a single filtered day can't show a meaningful
        // day-of-week pattern and hour-of-day is more useful aggregated
        // across every day on record than for one day in isolation.
        // hourCounts index = hour of day (0-23); dayCounts index = Carbon's
        // dayOfWeek (0 = Sunday .. 6 = Saturday), both in Asia/Manila.
        $hourCounts = array_fill(0, 24, 0);
        $dayCounts = array_fill(0, 7, 0);

        foreach ($orders as $order) {
            $fee = (float) $order->ServiceFee;
            $placedAt = Carbon::parse($order->OrderDate, 'UTC')->setTimezone($timezone);
            $date = $placedAt->toDateString();
            $daily[$date] = ($daily[$date] ?? 0) + $fee;
            $hourCounts[$placedAt->hour]++;
            $dayCounts[$placedAt->dayOfWeek]++;

            if ($requestedDate && $date !== $requestedDate) continue;

            $total += $fee;
            $orderCount++;
            $service = $order->payments->isNotEmpty()
                ? 'bills'
                : ($order->OrderSnapshot['section'] ?? ($order->items->first()?->product?->brand?->service?->ServiceType === 'item' ? 'item' : 'food'));
            $byService[$service] = ($byService[$service] ?? 0) + $fee;
        }

        ksort($daily);
        $dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        $peakHour = array_search(max($hourCounts), $hourCounts);
        $peakDay = array_search(max($dayCounts), $dayCounts);

        return response()->json([
            'total' => round($total, 2),
            'byService' => array_map(fn ($value) => round($value, 2), $byService),
            'daily' => collect($daily)->map(fn ($value, $date) => ['date' => $date, 'revenue' => round($value, 2)])->values(),
            'orderCount' => $orderCount,
            'peakHours' => collect($hourCounts)->map(fn ($count, $hour) => ['hour' => $hour, 'orders' => $count])->values(),
            'peakDays' => collect($dayCounts)->map(fn ($count, $day) => ['day' => $dayNames[$day], 'orders' => $count])->values(),
            'peakHour' => array_sum($hourCounts) > 0 ? $peakHour : null,
            'peakDay' => array_sum($dayCounts) > 0 ? $dayNames[$peakDay] : null,
        ]);
    }

    // Position is computed fresh on every request from the actual set of
    // orders still waiting - never stored/decremented - so it can't drift
    // out of sync the way a mutated counter could under concurrent orders.
    // Only orders that still have a 'waiting' Queue row (i.e. haven't been
    // confirmed, declined, or otherwise moved yet) get a position; everyone
    // else gets null since they're no longer "in line."
    private function attachQueuePositions($paginated): void
    {
        $waitingOrderIds = Queue::where('QueueStatus', 'waiting')->orderBy('QueueDate')->pluck('OrderID');
        $positionByOrderId = [];
        foreach ($waitingOrderIds as $index => $orderId) {
            $positionByOrderId[$orderId] = $index + 1;
        }
        $paginated->getCollection()->transform(function (Order $order) use ($positionByOrderId) {
            $order->queuePosition = $positionByOrderId[$order->OrderID] ?? null;
            return $order;
        });
    }

    public function updateStatus(Request $request, Order $order): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'status' => ['required', Rule::in(['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])],
        ]);

        $isAdmin = $user->Role === 'admin';
        $isAssignedRider = $user->Role === 'driver' && $order->AssignedRiderID === $user->UserID;
        // A customer may cancel their own order themselves - but only their
        // own order, only to 'cancelled', and only while it's still
        // pending_rider. Once admin or a rider has actually started acting
        // on it (confirmed onward), it's out of the customer's hands; they'd
        // need to contact the business directly at that point.
        $isOwningCustomerCancelling = $user->Role === 'customer'
            && $order->UserID === $user->UserID
            && $data['status'] === 'cancelled'
            && $order->DeliveryStatus === 'pending_rider'
            && is_null($order->AssignedRiderID);
        abort_unless($isAdmin || $isAssignedRider || $isOwningCustomerCancelling, 403);
        abort_if(in_array($order->DeliveryStatus, ['delivered', 'cancelled'], true), 422, 'This order is already finalized.');

        $order->update(['DeliveryStatus' => $data['status'], 'StatusUpdatedAt' => now()]);
        // Any explicit status transition means the order left the raw
        // pre-confirmation line (confirmed, or declined via 'cancelled') -
        // it's either now being actively tracked through its own progress
        // steps, or done entirely. Guarded by QueueStatus='waiting' so a
        // later transition on the same order (confirmed -> preparing) is a
        // harmless no-op instead of re-touching an already-closed entry.
        $order->queueEntries()->where('QueueStatus', 'waiting')->update(['QueueStatus' => 'done']);
        $this->notifyStatusChange($order, $data['status']);
        return response()->json(['order' => $order->fresh(['items.product', 'rider'])]);
    }

    // Admin/rider actions were the actual gap step 1g exists to close: an
    // order placed on a customer's own phone gets accepted/declined from an
    // admin's console on a completely different device, and the customer
    // needs to find out regardless of which device they check from next -
    // a notification written only to the acting admin/rider's own browser
    // (the old localStorage-only behavior) never reached them at all.
    private function notifyStatusChange(Order $order, string $status): void
    {
        $content = [
            'confirmed' => ['Order accepted', 'was accepted. Tracking is now available.'],
            'cancelled' => ['Order cancelled', 'was cancelled.'],
            'preparing' => ['Order is being prepared', 'is now being prepared.'],
            'out_for_delivery' => ['Order is out for delivery', 'is on the way.'],
            'delivered' => ['Order delivered', 'has been delivered.'],
        ][$status] ?? null;
        if (!$content) return;

        // A customer never saw who was actually delivering their order -
        // no customer-facing component read AssignedRiderID at all. Rather
        // than build a separate "your rider" UI, the rider's name rides
        // along in the same notification a customer already checks: once
        // one is assigned and explicitly accepts the order, the acceptance
        // and delivery updates name them by first name - the message stays
        // honest (no name) for the states before a rider is assigned.
        $riderName = $order->rider?->UserName;
        $riderSuffix = $riderName && in_array($status, ['confirmed', 'out_for_delivery', 'delivered'], true)
            ? " {$this->firstName($riderName)} is your rider."
            : '';

        Notification::create([
            'UserID' => $order->UserID,
            'NotificationMessage' => json_encode([
                'title' => $content[0],
                'message' => "Order #{$order->OrderID} {$content[1]}{$riderSuffix}",
                'type' => $status === 'cancelled' ? 'cancelled' : 'status',
                'orderId' => $order->OrderID,
            ]),
            'NotificationSeen' => false,
            'NotificationDate' => now(),
        ]);
    }

    private function firstName(string $fullName): string
    {
        return trim(explode(' ', trim($fullName))[0]) ?: $fullName;
    }

    public function assign(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'riderId' => ['nullable', 'integer', 'exists:Users,UserID'],
        ]);

        $riderId = $data['riderId'] ?? null;
        if ($riderId) {
            $rider = User::find($riderId);
            abort_unless($rider && $rider->Role === 'driver', 422, 'That user is not a rider.');
        }

        // Assignment reserves the order for a rider, but is not acceptance.
        // The assigned rider explicitly confirms or cancels it from their
        // dashboard; only that status action advances the queue and informs
        // the customer that the order was accepted.
        $order->update(['AssignedRiderID' => $riderId]);

        return response()->json(['order' => $order->fresh(['items.product', 'rider'])]);
    }
}
