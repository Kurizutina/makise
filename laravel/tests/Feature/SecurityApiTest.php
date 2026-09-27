<?php

namespace Tests\Feature;

use App\Models\Brand;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Automated evidence for the security cases committed to in the QA plan.
 *
 * TC-020: expired and revoked Sanctum tokens are rejected.
 * TC-021: non-admin identities cannot use administration endpoints.
 * TC-022: hostile input is stored as data, never treated as SQL.
 */
class SecurityApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, string $email): User
    {
        return User::create([
            'UserName' => ucfirst($role).' Test',
            'Email' => $email,
            'Role' => $role,
            'Contact' => '09123456789',
            'PasswordHash' => Hash::make('secret123'),
        ]);
    }

    public function test_tc_020_expired_and_revoked_sessions_are_rejected(): void
    {
        $customer = $this->user('customer', 'session-customer@example.com');
        $expiredToken = $customer->createToken('expired-test', ['*'], now()->subMinute())->plainTextToken;

        $this->withToken($expiredToken)->getJson('/api/auth/me')->assertUnauthorized();

        $validToken = $customer->createToken('logout-test')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withToken($validToken)->postJson('/api/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($validToken)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_tc_021_customer_and_driver_cannot_access_admin_endpoints(): void
    {
        $customer = $this->user('customer', 'rbac-customer@example.com');
        $driver = $this->user('driver', 'rbac-driver@example.com');

        $this->getJson('/api/admin/orders')->assertUnauthorized();

        foreach ([$customer, $driver] as $user) {
            $this->app['auth']->forgetGuards();
            $token = $user->createToken('rbac-test')->plainTextToken;

            $this->withToken($token)->getJson('/api/admin/orders')->assertForbidden();
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/admin/revenue')->assertForbidden();
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/admin/accounts/customer')->assertForbidden();
        }
    }

    public function test_tc_022_sql_injection_payload_is_persisted_as_literal_text(): void
    {
        $customer = $this->user('customer', 'sqli-customer@example.com');
        $brand = Brand::create(['BrandName' => 'Security Test Brand', 'IsActive' => true]);
        $product = Product::create([
            'ProductName' => 'Security Test Product',
            'BrandID' => $brand->BrandID,
            'ProductPrice' => 120,
            'IsActive' => true,
        ]);
        $payload = "CLSU Main Campus, Unit 1'; DROP TABLE Orders; --";

        $this->withToken($customer->createToken('sqli-test')->plainTextToken)
            ->postJson('/api/orders', [
                'items' => [['ProductID' => $product->ProductID, 'quantity' => 1]],
                'deliveryAddress' => $payload,
            ])
            ->assertCreated()
            ->assertJsonPath('order.DeliveryAddress', $payload);

        $this->assertDatabaseHas('Orders', ['DeliveryAddress' => $payload]);
        // A successful count after the hostile payload proves the table still
        // exists; the order itself is the only record created by this request.
        $this->assertSame(1, Order::query()->count());
    }

    public function test_all_api_errors_return_consistent_json_shape(): void
    {
        $customer = $this->user('customer', 'err-customer@example.com');
        $token = $customer->createToken('err-test')->plainTextToken;

        // 404 Model / Endpoint Not Found returns uniform {"error": "..."}
        $response = $this->withToken($token)->patchJson('/api/orders/999999/status', ['status' => 'delivered']);
        $response->assertNotFound();
        $response->assertJsonStructure(['error']);
        $this->assertFalse(array_key_exists('trace', $response->json()));

        $this->app['auth']->forgetGuards();

        // 403 Forbidden returns uniform {"error": "..."}
        $response403 = $this->withToken($token)->getJson('/api/admin/orders');
        $response403->assertForbidden();
        $response403->assertJsonStructure(['error']);

        $this->app['auth']->forgetGuards();

        // 401 Unauthenticated returns uniform {"error": "..."}
        $response401 = $this->withHeaders(['Authorization' => 'Bearer invalid-token'])->getJson('/api/auth/me');
        $response401->assertUnauthorized();
        $response401->assertJsonStructure(['error']);
    }
}

