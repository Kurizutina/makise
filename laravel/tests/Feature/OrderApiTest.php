<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Notification;
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
            'clientOrderId' => 'ORD-browser-123',
            'deliveryAddress' => '123 Test Street',
            // A malicious client could try to smuggle its own price/total; the
            // endpoint doesn't even accept those fields, so there's nothing to trust.
        ])->assertCreated();

        $this->assertEquals(450, (float) $response->json('order.TotalPrice'));
        $this->assertSame('ORD-browser-123', $response->json('order.OrderSnapshot.clientOrderId'));
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

    public function test_custom_menu_order_is_persisted_and_its_service_fee_is_revenue(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');

        $response = $this->withToken($this->token($customer))->postJson('/api/orders', [
            'customItems' => [['name' => 'Special burger', 'quantity' => 2, 'price' => 95]],
            'source' => 'Local Burger Shop',
            'label' => '2pc Special burger',
            'section' => 'food',
            'deliveryAddress' => '123 Test Street',
            'serviceFee' => 75,
        ])->assertCreated();

        $orderId = $response->json('order.OrderID');
        $this->assertDatabaseHas('Orders', [
            'OrderID' => $orderId, 'TotalPrice' => 265, 'ServiceFee' => 75,
        ]);
        $this->assertSame('Local Burger Shop', $response->json('order.OrderSnapshot.source'));

        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($admin))->getJson('/api/admin/orders')
            ->assertOk()->assertJsonPath('data.0.OrderID', $orderId);
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($admin))->getJson('/api/admin/revenue')
            ->assertOk()->assertJsonPath('total', 75);
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
            ->assertJsonPath('order.DeliveryStatus', 'pending_rider');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => null,
        ])->assertOk()->assertJsonPath('order.AssignedRiderID', null);
    }

    // No customer-facing component read AssignedRiderID at all - a
    // customer never saw who was actually delivering their order. Rather
    // than build a separate "your rider" UI, the name rides along in the
    // notification a customer already checks, once that rider explicitly
    // accepts the assigned order.
    public function test_rider_confirmation_names_them_in_the_customer_notification(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $rider->UserName = 'Juan Dela Cruz';
        $rider->save();
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);
        $admin = $this->user('admin');

        $this->withToken($this->token($admin))->patchJson("/api/orders/{$order->OrderID}/assign", [
            'riderId' => $rider->UserID,
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'pending_rider');

        $this->assertDatabaseMissing('Notification', ['UserID' => $customer->UserID]);

        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($rider))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'confirmed',
        ])->assertOk();

        $message = json_decode(Notification::where('UserID', $customer->UserID)->latest('NotificationID')->first()->NotificationMessage, true);
        $this->assertStringContainsString('Juan is your rider.', $message['message']);
    }

    // Before a rider is assigned there's nothing honest to say about who's
    // delivering - the cancellation notification must not claim otherwise.
    public function test_notification_omits_rider_name_when_none_is_assigned(): void
    {
        $customer = $this->user('customer');
        $order = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 100, 'DeliveryStatus' => 'pending_rider']);

        $this->withToken($this->token($customer))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'cancelled',
        ])->assertOk();

        $message = json_decode(Notification::where('UserID', $customer->UserID)->latest('NotificationID')->first()->NotificationMessage, true);
        $this->assertStringNotContainsString('is your rider', $message['message']);
    }

    public function test_rider_delivery_notifies_the_owning_customer(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create([
            'UserID' => $customer->UserID,
            'AssignedRiderID' => $rider->UserID,
            'TotalPrice' => 100,
            'DeliveryStatus' => 'out_for_delivery',
        ]);

        $this->withToken($this->token($rider))->patchJson("/api/orders/{$order->OrderID}/status", [
            'status' => 'delivered',
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'delivered');

        $notification = Notification::where('UserID', $customer->UserID)->latest('NotificationID')->firstOrFail();
        $message = json_decode($notification->NotificationMessage, true);
        $this->assertSame('Order delivered', $message['title']);
        $this->assertSame($order->OrderID, $message['orderId']);
    }

    public function test_each_rider_progress_update_notifies_the_owning_customer(): void
    {
        $customer = $this->user('customer');
        $rider = $this->user('driver');
        $order = Order::create([
            'UserID' => $customer->UserID,
            'AssignedRiderID' => $rider->UserID,
            'TotalPrice' => 100,
            'DeliveryStatus' => 'confirmed',
        ]);

        foreach ([
            'preparing' => 'Order is being prepared',
            'out_for_delivery' => 'Order is out for delivery',
            'delivered' => 'Order delivered',
        ] as $status => $title) {
            $this->withToken($this->token($rider))
                ->patchJson("/api/orders/{$order->OrderID}/status", ['status' => $status])
                ->assertOk()->assertJsonPath('order.DeliveryStatus', $status);

            $notification = Notification::where('UserID', $customer->UserID)
                ->latest('NotificationID')->firstOrFail();
            $message = json_decode($notification->NotificationMessage, true);
            $this->assertSame($title, $message['title']);
            $this->assertSame($order->OrderID, $message['orderId']);
        }
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
        ])->assertOk()->assertJsonPath('order.DeliveryStatus', 'pending_rider');

        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($customer))->patchJson("/api/orders/{$secondOrder->OrderID}/status", [
            'status' => 'cancelled',
        ])->assertForbidden();

        $this->assertDatabaseHas('Orders', [
            'OrderID' => $secondOrder->OrderID,
            'AssignedRiderID' => $rider->UserID,
            'DeliveryStatus' => 'pending_rider',
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

    // Layer 1 analytics (peak ordering time). Two orders land in Manila
    // Monday 04:00, one in Manila Friday 18:00, plus a cancelled order at a
    // third hour/day that would otherwise dominate - it must be excluded,
    // same as it already is from every other figure this endpoint returns.
    public function test_admin_revenue_reports_peak_hour_and_day(): void
    {
        $customer = $this->user('customer');
        $admin = $this->user('admin');

        $mondayA = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'delivered']);
        $mondayA->OrderDate = '2026-09-20 20:00:00'; // 2026-09-21 04:00 Manila, Monday
        $mondayA->save();
        $mondayB = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'delivered']);
        $mondayB->OrderDate = '2026-09-20 20:15:00'; // same Manila hour/day
        $mondayB->save();
        $friday = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'delivered']);
        $friday->OrderDate = '2026-09-25 10:00:00'; // 2026-09-25 18:00 Manila, Friday
        $friday->save();
        $cancelled = Order::create(['UserID' => $customer->UserID, 'TotalPrice' => 175, 'ServiceFee' => 75, 'DeliveryStatus' => 'cancelled']);
        $cancelled->OrderDate = '2026-09-22 01:00:00'; // would otherwise be the peak alone
        $cancelled->save();

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/revenue')->assertOk();

        $this->assertEquals(4, $response->json('peakHour'));
        $this->assertEquals('Monday', $response->json('peakDay'));
        $peakHours = collect($response->json('peakHours'));
        $this->assertEquals(2, $peakHours->firstWhere('hour', 4)['orders']);
        $this->assertEquals(1, $peakHours->firstWhere('hour', 18)['orders']);
        $peakDays = collect($response->json('peakDays'));
        $this->assertEquals(2, $peakDays->firstWhere('day', 'Monday')['orders']);
        $this->assertEquals(1, $peakDays->firstWhere('day', 'Friday')['orders']);
    }

    public function test_only_admin_can_view_revenue(): void
    {
        $customer = $this->user('customer');
        $driver = $this->user('driver');

        $this->withToken($this->token($customer))->getJson('/api/admin/revenue')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($driver))->getJson('/api/admin/revenue')->assertForbidden();
    }

    // Layer 2 analytics (RFM segmentation). Exactly two customers with
    // maximally different profiles - with only two data points, quintile
    // scoring places them at the extremes (1 and 5) on every dimension,
    // so the resulting segments are deterministic regardless of exact
    // scoring-curve details. customerB's cancelled order would double its
    // frequency/monetary if wrongly counted - same exclusion Revenue
    // already applies.
    public function test_admin_customer_segments_classifies_champions_and_lost(): void
    {
        $admin = $this->user('admin');
        $customerA = $this->user('customer', 'frequent@test.com');
        $customerB = $this->user('customer', 'inactive@test.com');

        for ($i = 0; $i < 5; $i++) {
            Order::create([
                'UserID' => $customerA->UserID, 'TotalPrice' => 300, 'ServiceFee' => 75,
                'DeliveryStatus' => 'delivered', 'OrderDate' => now()->subDays($i),
            ]);
        }
        $old = Order::create([
            'UserID' => $customerB->UserID, 'TotalPrice' => 50, 'ServiceFee' => 25, 'DeliveryStatus' => 'delivered',
        ]);
        $old->OrderDate = now()->subDays(300);
        $old->save();
        // Must not count - cancelled.
        Order::create(['UserID' => $customerB->UserID, 'TotalPrice' => 999, 'ServiceFee' => 500, 'DeliveryStatus' => 'cancelled']);

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/customer-segments')->assertOk();

        $this->assertEquals(2, $response->json('totalCustomers'));
        $byEmail = collect($response->json('customers'))->keyBy('email');

        $frequent = $byEmail['frequent@test.com'];
        $this->assertEquals('Champions', $frequent['segment']);
        $this->assertEquals(5, $frequent['frequency']);
        $this->assertEquals(1500, $frequent['monetary']);

        $inactive = $byEmail['inactive@test.com'];
        $this->assertEquals('Lost', $inactive['segment']);
        $this->assertEquals(1, $inactive['frequency']);
        $this->assertEquals(50, $inactive['monetary']);
    }

    public function test_customer_with_no_orders_is_excluded_from_segments(): void
    {
        $admin = $this->user('admin');
        $this->user('customer', 'noorders@test.com');

        $response = $this->withToken($this->token($admin))->getJson('/api/admin/customer-segments')->assertOk();

        $this->assertEquals(0, $response->json('totalCustomers'));
    }

    public function test_only_admin_can_view_customer_segments(): void
    {
        $customer = $this->user('customer');
        $driver = $this->user('driver');

        $this->withToken($this->token($customer))->getJson('/api/admin/customer-segments')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($this->token($driver))->getJson('/api/admin/customer-segments')->assertForbidden();
    }
}
