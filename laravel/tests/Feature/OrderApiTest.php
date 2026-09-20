<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OrderApiTest extends TestCase
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

    private function product(float $price = 100, bool $active = true): Product
    {
        $brand = Brand::create(['BrandName' => 'Test Brand '.uniqid(), 'IsActive' => true]);
        return Product::create([
            'ProductName' => 'Test Item', 'BrandID' => $brand->BrandID,
            'ProductPrice' => $price, 'IsActive' => $active,
        ]);
    }

    public function test_customer_can_place_an_order_with_server_computed_total(): void
    {
        $customer = $this->user('customer');
        $product = $this->product(price: 150);

        $response = $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => $product->ProductID, 'quantity' => 3]],
            'deliveryAddress' => '123 Test Street',
            // A malicious client could try to smuggle its own price/total; the
            // endpoint doesn't even accept those fields, so there's nothing to trust.
        ])->assertCreated();

        $this->assertEquals(450, (float) $response->json('order.TotalPrice'));
        $this->assertDatabaseHas('Orders', [
            'UserID' => $customer->UserID, 'TotalPrice' => 450, 'DeliveryStatus' => 'pending_rider',
        ]);
        $this->assertDatabaseHas('OrderItem', [
            'ProductID' => $product->ProductID, 'OrderItemPrice' => 150, 'ProductQuantity' => 3,
        ]);
    }

    public function test_order_rejects_inactive_or_missing_products(): void
    {
        $customer = $this->user('customer');
        $inactive = $this->product(active: false);

        $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => $inactive->ProductID, 'quantity' => 1]],
            'deliveryAddress' => '123 Test Street',
        ])->assertUnprocessable();

        $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => 999999, 'quantity' => 1]],
            'deliveryAddress' => '123 Test Street',
        ])->assertUnprocessable();
    }

    public function test_only_customers_can_place_orders(): void
    {
        $driver = $this->user('driver');
        $product = $this->product();

        $this->withToken($this->token($driver))->postJson('/api/orders', [
            'items' => [['ProductID' => $product->ProductID, 'quantity' => 1]],
            'deliveryAddress' => '123 Test Street',
        ])->assertForbidden();
    }

    public function test_customer_only_sees_their_own_orders(): void
    {
        $customerA = $this->user('customer', 'a@example.com');
        $customerB = $this->user('customer', 'b@example.com');
        Order::create(['UserID' => $customerA->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        Order::create(['UserID' => $customerB->UserID, 'TotalPrice' => 200, 'DeliveryStatus' => 'pending_rider']);

        $response = $this->withToken($this->token($customerA))->getJson('/api/orders')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals($customerA->UserID, $response->json('data.0.UserID'));
    }

    public function test_driver_only_sees_orders_assigned_to_them(): void
    {
        $customer = $this->user('customer');
        $riderA = $this->user('driver', 'riderA@example.com');
        $riderB = $this->user('driver', 'riderB@example.com');
        Order::create(['UserID' => $customer->UserID, 'AssignedRiderID' => $riderA->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'confirmed']);
        Order::create(['UserID' => $customer->UserID, 'AssignedRiderID' => $riderB->UserID, 'TotalPrice' => 200, 'DeliveryStatus' => 'confirmed']);
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 300, 'DeliveryStatus' => 'pending_rider']);

        $response = $this->withToken($this->token($riderA))->getJson('/api/orders')->assertOk();
        $this->assertCount(1, $response->json('data'));
        $this->assertEquals($riderA->UserID, $response->json('data.0.AssignedRiderID'));
    }

    public function test_only_admin_can_list_all_orders(): void
    {
        $customer = $this->user('customer');
        $driver = $this->user('driver');
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 200, 'DeliveryStatus' => 'confirmed']);

        $this->withToken($this->token($customer))->getJson('/api/admin/orders')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($driver))->getJson('/api/admin/orders')->assertForbidden();
        $this->app['auth']->forgetGuards();

        $admin = $this->user('admin');
        $response = $this->withToken($this->token($admin))->getJson('/api/admin/orders')->assertOk();
        $this->assertCount(2, $response->json('data'));
    }

    public function test_admin_can_assign_and_unassign_a_rider(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        $admin = $this->user('admin');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertOk()->assertJsonPath('order.AssignedRiderID', $rider->UserID);

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => null,
        ])->assertOk()->assertJsonPath('order.AssignedRiderID', null);
    }

    public function test_only_admin_can_assign_a_rider(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);

        $this->withToken($this->token($customer))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($rider))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertForbidden();
    }

    public function test_assign_rejects_a_non_rider_user(): void
    {
        $customer = $this->user('customer');
        $otherCustomer = $this->user('customer', 'other@example.com');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        $admin = $this->user('admin');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $otherCustomer->UserID,
        ])->assertUnprocessable();
    }

    public function test_admin_and_assigned_rider_can_update_status(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create([
            'UserID' => $customer->UserID, 'AssignedRiderID' => $rider->UserID,
            'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider',
        ]);

        $this->withToken($this->token($rider))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'confirmed',
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'confirmed');

        $admin = $this->user('admin');
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'delivered',
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'delivered');
    }

    public function test_unassigned_rider_and_customer_cannot_update_status(): void
    {
        $customer = $this->user('customer');
        $assignedRider = $this->user('driver', 'assigned@example.com');
        $otherRider = $this->user('driver', 'other@example.com');
        $order = Order::create([
            'UserID' => $customer->UserID, 'AssignedRiderID' => $assignedRider->UserID,
            'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider',
        ]);

        $this->withToken($this->token($otherRider))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'confirmed',
        ])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($customer))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'confirmed',
        ])->assertForbidden();
    }

    public function test_finalized_order_status_cannot_be_changed(): void
    {
        $customer = $this->user('customer');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'delivered']);
        $admin = $this->user('admin');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'cancelled',
        ])->assertUnprocessable();
    }
}
