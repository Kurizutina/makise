<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class MessageApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $email = null): User
    {
        return User::create([
            'UserName' => ucfirst($role), 'Email' => $email ?? $role.'@example.com', 'Role' => $role,
            'Contact' => '09123456789', 'PasswordHash' => Hash::make('secret123'),
        ]);
    }

    private function token(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    private function order(User $customer, ?User $rider = null, string $status = 'confirmed'): Order
    {
        return Order::create([
            'UserID' => $customer->UserID, 'AssignedRiderID' => $rider?->UserID,
            'TotalPrice' => 500, 'ServiceFee' => 75, 'OrderDate' => now(),
            'DeliveryAddress' => 'Test Address', 'DeliveryStatus' => $status,
        ]);
    }

    // Sanctum caches the resolved user on the auth guard for the life of a
    // test, so switching which token a subsequent request in the same test
    // uses silently keeps authenticating as whoever resolved first unless
    // the guard is reset first - same gotcha AuthApiTest already works
    // around. Route through this instead of calling withToken() directly
    // whenever a test authenticates as a different user than its last call.
    private function as(User $user)
    {
        $this->app['auth']->forgetGuards();
        return $this->withToken($this->token($user));
    }

    public function test_customer_and_assigned_rider_can_exchange_messages(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = $this->order($customer, $rider);

        $this->as($customer)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => 'Please leave it at the guard house.',
        ])->assertCreated();

        $this->as($rider)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => 'Got it, on my way.',
        ])->assertCreated();

        $response = $this->as($customer)->getJson("/api/orders/{$order->OrderID}/messages")->assertOk();
        $messages = $response->json('messages');
        $this->assertCount(2, $messages);
        $this->assertEquals('Please leave it at the guard house.', $messages[0]['MessageBody']);
        $this->assertEquals($customer->UserID, $messages[0]['SenderUserID']);
        $this->assertEquals('Got it, on my way.', $messages[1]['MessageBody']);
        $this->assertEquals($rider->UserID, $messages[1]['SenderUserID']);
    }

    public function test_a_user_not_party_to_the_order_cannot_see_or_send_messages(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = $this->order($customer, $rider);
        $otherCustomer = $this->user('customer', 'other-customer@example.com');
        $otherRider = $this->user('driver', 'other-rider@example.com');

        $this->as($otherCustomer)->getJson("/api/orders/{$order->OrderID}/messages")->assertStatus(403);
        $this->as($otherRider)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => 'Trying to butt in.',
        ])->assertStatus(403);
    }

    public function test_messaging_is_closed_until_a_rider_is_assigned(): void
    {
        $customer = $this->user('customer');
        $order = $this->order($customer, null, 'pending_rider');

        $this->as($customer)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => 'Hello?',
        ])->assertStatus(422);
    }

    public function test_messaging_closes_once_the_order_is_finalized(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $delivered = $this->order($customer, $rider, 'delivered');
        $cancelled = $this->order($customer, $rider, 'cancelled');

        $this->as($customer)->postJson("/api/orders/{$delivered->OrderID}/messages", [
            'body' => 'Thanks!',
        ])->assertStatus(422);

        $this->as($customer)->postJson("/api/orders/{$cancelled->OrderID}/messages", [
            'body' => 'Never mind.',
        ])->assertStatus(422);
    }

    public function test_message_body_is_required_and_bounded(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = $this->order($customer, $rider);

        $this->as($customer)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => '',
        ])->assertStatus(422);

        $this->as($customer)->postJson("/api/orders/{$order->OrderID}/messages", [
            'body' => str_repeat('a', 1001),
        ])->assertStatus(422);
    }

    public function test_marking_read_only_affects_the_other_participants_messages(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = $this->order($customer, $rider);

        $this->as($customer)->postJson("/api/orders/{$order->OrderID}/messages", ['body' => 'From customer']);
        $this->as($rider)->postJson("/api/orders/{$order->OrderID}/messages", ['body' => 'From rider']);

        $this->as($customer)->patchJson("/api/orders/{$order->OrderID}/messages/read")->assertOk();

        $messages = $this->as($customer)->getJson("/api/orders/{$order->OrderID}/messages")->json('messages');
        $byBody = collect($messages)->keyBy('MessageBody');
        $this->assertFalse((bool) $byBody['From customer']['MessageSeen']);
        $this->assertTrue((bool) $byBody['From rider']['MessageSeen']);
    }
}
