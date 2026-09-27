<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    // Order-scoped chat between a customer and their assigned rider only -
    // not a general inbox, and not open to admin. Both index/store share the
    // same ownership check: the order's own customer, or the rider it's
    // currently assigned to. Neither role can see or send into an order
    // they're not part of.
    private function authorizeParticipant(Request $request, Order $order): void
    {
        $user = $request->user();
        $isOwningCustomer = $user->Role === 'customer' && $order->UserID === $user->UserID;
        $isAssignedRider = $user->Role === 'driver' && $order->AssignedRiderID === $user->UserID;
        abort_unless($isOwningCustomer || $isAssignedRider, 403);
    }

    public function index(Request $request, Order $order): JsonResponse
    {
        $this->authorizeParticipant($request, $order);
        return response()->json([
            'messages' => $order->messages()->with('sender:UserID,UserName,Role')->orderBy('MessageDate')->get(),
        ]);
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        $this->authorizeParticipant($request, $order);
        // Messaging only makes sense once there's someone on the other end,
        // and stops mattering once the order is finalized - matches the
        // product-intake recommendation ("only after a rider is assigned...
        // close messaging after delivery/cancellation") rather than leaving
        // it open indefinitely.
        abort_if(is_null($order->AssignedRiderID), 422, 'A rider has not been assigned to this order yet.');
        abort_if(in_array($order->DeliveryStatus, ['delivered', 'cancelled'], true), 422, 'This order is finalized - messaging is closed.');

        $data = $request->validate(['body' => ['required', 'string', 'max:1000']]);
        $message = $order->messages()->create([
            'SenderUserID' => $request->user()->UserID,
            'MessageBody' => $data['body'],
            'MessageSeen' => false,
            'MessageDate' => now(),
        ]);
        // ->fresh() re-reads MessageDate as the same naive "Y-m-d H:i:s"
        // string index() returns - the in-memory model just created still
        // holds the raw now() Carbon instance, which serializes with a "Z"
        // and would double up with toUtcIso() on the frontend (same class
        // of bug as the naive-datetime gotcha already documented).
        return response()->json(['message' => $message->fresh()->load('sender:UserID,UserName,Role')], 201);
    }

    public function markRead(Request $request, Order $order): JsonResponse
    {
        $this->authorizeParticipant($request, $order);
        $order->messages()
            ->where('SenderUserID', '!=', $request->user()->UserID)
            ->where('MessageSeen', false)
            ->update(['MessageSeen' => true]);
        return response()->json(['status' => 'ok']);
    }
}
