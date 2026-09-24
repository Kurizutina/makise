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

    public function test_order_persists_service_fee_and_adds_it_to_total(): void
    {
        $customer = $this->user('customer');
        $product = $this->product(price: 150);

        $response = $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => $product->ProductID, 'quantity' => 2]],
            'deliveryAddress' => '123 Test Street',
            'serviceFee' => 112.5,
        ])->assertCreated();

        $this->assertEquals(412.5, (float) $response->json('order.TotalPrice'));
        $this->assertDatabaseHas('Orders', [
            'UserID' => $customer->UserID, 'TotalPrice' => 412.5, 'ServiceFee' => 112.5,
        ]);
    }

    public function test_order_rejects_a_service_fee_outside_the_sane_range(): void
    {
        $customer = $this->user('customer');
        $product = $this->product();

        $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => $product->ProductID, 'quantity' => 1]],
            'deliveryAddress' => '123 Test Street',
            'serviceFee' => -5,
        ])->assertUnprocessable();

        $this->withToken($this->token($customer))->postJson('/api/orders', [
            'items' => [['ProductID' => $product->ProductID, 'quantity' => 1]],
            'deliveryAddress' => '123 Test Street',
            'serviceFee' => 9999,
        ])->assertUnprocessable();
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

    // History fetches its own page directly from this endpoint (instead of
    // reading from the same capped list Live Orders uses) filtered to
    // delivered+cancelled in one request - covers both the existing
    // single-status filter and the new comma-separated multi-status one.
    public function test_admin_order_list_filters_by_one_or_several_statuses(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 200, 'DeliveryStatus' => 'delivered']);
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 300, 'DeliveryStatus' => 'cancelled']);

        $token = $this->token($admin);
        $single = $this->withToken($token)->getJson('/api/admin/orders?status=delivered')->assertOk();
        $this->assertCount(1, $single->json('data'));
        $this->assertEquals('delivered', $single->json('data.0.DeliveryStatus'));

        $this->app['auth']->forgetGuards();
        $multi = $this->withToken($this->token($admin))->getJson('/api/admin/orders?status=delivered,cancelled')->assertOk();
        $statuses = collect($multi->json('data'))->pluck('DeliveryStatus')->sort()->values()->all();
        $this->assertEquals(['cancelled', 'delivered'], $statuses);
    }

    // History's exact-date filter - orders are stored with a naive UTC
    // OrderDate, so a Manila-midnight order (still "yesterday" in UTC) has to
    // land on the requested date and an order just outside the window must
    // not.
    public function test_admin_order_list_filters_by_exact_manila_date(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');
        $inDay = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'delivered']);
        $inDay->OrderDate = '2026-09-22 16:30:00'; // 2026-09-23 00:30 Manila
        $inDay->save();
        $dayBefore = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'delivered']);
        $dayBefore->OrderDate = '2026-09-22 15:59:00'; // 2026-09-22 23:59 Manila
        $dayBefore->save();

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/orders?date=2026-09-23')->assertOk();
        $this->assertEquals([$inDay->OrderID], collect($response->json('data'))->pluck('OrderID')->all());
    }

    public function test_admin_can_assign_and_unassign_a_rider(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        $admin = $this->user('admin');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertOk()
            ->assertJsonPath('order.AssignedRiderID', $rider->UserID)
            ->assertJsonPath('order.DeliveryStatus', 'confirmed');

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

    public function test_customer_can_cancel_only_before_a_rider_is_selected(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');
        $rider = $this->user('driver');
        $firstOrder = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        $secondOrder = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);

        $this->withToken($this->token($customer))->patchJson("/api/orders/{$firstOrder->OrderID}/status", [
            'status' => 'cancelled',
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'cancelled');

        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($admin))->patchJson("/api/orders/{$secondOrder->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'confirmed');

        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($customer))->patchJson("/api/orders/{$secondOrder->OrderID}/status", [
            'status' => 'cancelled',
        ])->assertForbidden();

        $this->assertDatabaseHas('Orders', [
            'OrderID' => $secondOrder->OrderID,
            'AssignedRiderID' => $rider->UserID,
            'DeliveryStatus' => 'confirmed',
        ]);
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

    // Reproduces the actual bug: the admin dashboard used to derive "total
    // revenue" by summing whichever page of orders it had loaded for
    // display (capped at 50, per_page=50). Create more than 50 real orders
    // so a fix that's still secretly bounded by that same page size would
    // get caught here, then confirm the endpoint's total matches every
    // order's ServiceFee, not just the most recent 50.
    public function test_admin_revenue_aggregates_every_order_not_just_the_first_page(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');

        $expectedTotal = 0.0;
        for ($i = 0; $i < 55; $i++) {
            $fee = 75.0;
            $expectedTotal += $fee;
            Order::create([
                'UserID' => $customer->UserID, 'TotalPrice' => 100 + $fee, 'ServiceFee' => $fee,
                'DeliveryStatus' => 'delivered',
            ]);
        }
        // A cancelled order's fee must not count toward revenue.
        Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'cancelled']);

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/revenue')->assertOk();

        $this->assertEquals($expectedTotal, (float) $response->json('total'));
        $this->assertEquals(55, $response->json('orderCount'));
    }

    // ?date narrows total/byService/orderCount to that one Manila calendar
    // day, but `daily` must still return every day on record - that series
    // feeds the trend graph, which would be pointless if picking a date also
    // collapsed the chart down to a single point.
    public function test_admin_revenue_date_filter_narrows_totals_but_not_the_daily_series(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');

        $today = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'delivered']);
        $today->OrderDate = '2026-09-22 16:30:00'; // 2026-09-23 00:30 Manila
        $today->save();
        $yesterday = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 150, 'ServiceFee' => 50, 'DeliveryStatus' => 'delivered']);
        $yesterday->OrderDate = '2026-09-21 16:30:00'; // 2026-09-22 00:30 Manila
        $yesterday->save();

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/revenue?date=2026-09-23')->assertOk();

        $this->assertEquals(75.0, (float) $response->json('total'));
        $this->assertEquals(1, $response->json('orderCount'));
        $this->assertCount(2, $response->json('daily'));
    }

    public function test_only_admin_can_view_revenue(): void
    {
        $customer = $this->user('customer');
        $driver = $this->user('driver');

        $this->withToken($this->token($customer))->getJson('/api/admin/revenue')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($driver))->getJson('/api/admin/revenue')->assertForbidden();
    }
}
