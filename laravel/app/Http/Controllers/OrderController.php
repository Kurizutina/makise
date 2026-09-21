<?php

namespace App\Http\Controllers;

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
            'items' => ['required', 'array', 'min:1'],
            'items.*.ProductID' => ['required', 'integer', 'distinct', 'exists:Product,ProductID'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'deliveryAddress' => ['required', 'string', 'max:2000'],
        ]);

        $order = DB::transaction(function () use ($data, $request) {
            $productIds = collect($data['items'])->pluck('ProductID');
            $products = Product::whereIn('ProductID', $productIds)->where('IsActive', true)->get()->keyBy('ProductID');

            $totalPrice = 0;
            $lineItems = [];
            foreach ($data['items'] as $item) {
                $product = $products->get($item['ProductID']);
                abort_unless($product, 422, 'One or more items are no longer available.');
                $totalPrice += $product->ProductPrice * $item['quantity'];
                $lineItems[] = [
                    'ProductID' => $product->ProductID,
                    'OrderItemPrice' => $product->ProductPrice,
                    'ProductQuantity' => $item['quantity'],
                ];
            }

            $order = Order::create([
                'UserID' => $request->user()->UserID,
                'TotalPrice' => $totalPrice,
                'OrderDate' => now(),
                'DeliveryAddress' => $data['deliveryAddress'],
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
        $status = $request->query('status');
        if ($status) $query->where('DeliveryStatus', $status);

        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        $paginated = $query->paginate($perPage);
        $this->attachQueuePositions($paginated);
        return response()->json($paginated);
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
        $isAdmin = $user->Role === 'admin';
        $isAssignedRider = $user->Role === 'driver' && $order->AssignedRiderID === $user->UserID;
        abort_unless($isAdmin || $isAssignedRider, 403);
        abort_if(in_array($order->DeliveryStatus, ['delivered', 'cancelled'], true), 422, 'This order is already finalized.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'])],
        ]);

        $order->update(['DeliveryStatus' => $data['status']]);
        // Any explicit status transition means the order left the raw
        // pre-confirmation line (confirmed, or declined via 'cancelled') -
        // it's either now being actively tracked through its own progress
        // steps, or done entirely. Guarded by QueueStatus='waiting' so a
        // later transition on the same order (confirmed -> preparing) is a
        // harmless no-op instead of re-touching an already-closed entry.
        $order->queueEntries()->where('QueueStatus', 'waiting')->update(['QueueStatus' => 'done']);
        return response()->json(['order' => $order->fresh(['items.product', 'rider'])]);
    }

    public function assign(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'riderId' => ['nullable', 'integer', 'exists:Users,UserID'],
        ]);

        if ($data['riderId'] ?? null) {
            $rider = User::find($data['riderId']);
            abort_unless($rider && $rider->Role === 'driver', 422, 'That user is not a rider.');
        }

        $order->update(['AssignedRiderID' => $data['riderId'] ?? null]);
        return response()->json(['order' => $order->fresh(['items.product', 'rider'])]);
    }
}
