<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\Order;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentController extends Controller
{
    // Creates the Orders + Payment pair backing a Pay Bills request. Bill
    // payments have no catalog Product to line up with OrderController::store,
    // so they get their own endpoint instead of reusing that one - the
    // resulting Order still flows through the normal rider/admin status
    // pipeline (a rider still has to go pay the bill in person), it just
    // starts with zero OrderItems.
    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->Role === 'customer', 403);
        $data = $request->validate([
            'establishment' => ['required', 'string', 'max:150'],
            'amount' => ['nullable', 'numeric', 'min:0', 'max:999999.99'],
            'method' => ['nullable', 'string', 'max:50'],
            'billReceiptUrl' => ['nullable', 'string', 'max:500'],
            'billReceiptName' => ['nullable', 'string', 'max:255'],
            'transferProofUrl' => ['nullable', 'string', 'max:500'],
            'transferProofName' => ['nullable', 'string', 'max:255'],
        ]);

        $payment = DB::transaction(function () use ($data, $request) {
            $order = Order::create([
                'UserID' => $request->user()->UserID,
                'TotalPrice' => $data['amount'] ?? 0,
                'OrderDate' => now(),
                'DeliveryAddress' => null,
                'DeliveryStatus' => 'pending_rider',
            ]);

            // Payment has no dedicated columns for the uploaded proof files,
            // so they ride along as JSON in PaymentNote rather than adding a
            // migration on top of the team's predetermined schema.
            return $order->payments()->create([
                'PaymentName' => $data['establishment'],
                'PaymentMethod' => $data['method'] ?? null,
                'PaymentAmount' => $data['amount'] ?? 0,
                'PaymentStatus' => 'pending',
                'PaymentNote' => json_encode([
                    'billReceiptUrl' => $data['billReceiptUrl'] ?? null,
                    'billReceiptName' => $data['billReceiptName'] ?? null,
                    'transferProofUrl' => $data['transferProofUrl'] ?? null,
                    'transferProofName' => $data['transferProofName'] ?? null,
                ]),
            ]);
        });

        return response()->json(['payment' => $payment->fresh(), 'orderId' => $payment->OrderID], 201);
    }

    public function updateStatus(Request $request, Payment $payment): JsonResponse
    {
        abort_if(in_array($payment->PaymentStatus, ['verified', 'rejected'], true), 422, 'This payment is already finalized.');

        $data = $request->validate([
            'status' => ['required', Rule::in(['verified', 'rejected'])],
        ]);

        $payment->update(['PaymentStatus' => $data['status']]);
        // Same reasoning as OrderController::notifyStatusChange - admin
        // verifies/rejects from their own console, the customer needs to
        // find out on whichever device they check next.
        Notification::create([
            'UserID' => $payment->order->UserID,
            'NotificationMessage' => json_encode([
                'title' => "Payment {$data['status']}",
                'message' => "Your payment for {$payment->PaymentName} was {$data['status']}.",
                'type' => $data['status'] === 'rejected' ? 'cancelled' : 'status',
                'orderId' => $payment->OrderID,
            ]),
            'NotificationSeen' => false,
            'NotificationDate' => now(),
        ]);
        return response()->json(['payment' => $payment->fresh()]);
    }
}
