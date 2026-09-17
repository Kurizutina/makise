<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AccountManagementApiTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $role, string $email): User
    {
        return User::create([
            'UserName' => ucfirst($role).' Account', 'Email' => $email, 'Role' => $role,
            'Contact' => '09123456789', 'Address' => 'Quezon City', 'PasswordHash' => Hash::make('secret123'),
        ]);
    }

    public function test_admin_can_create_search_update_and_delete_rider_and_customer_accounts(): void
    {
        $admin = $this->account('admin', 'admin@example.com');
        $token = $admin->createToken('test')->plainTextToken;
        $existingCustomer = $this->account('customer', 'existing-customer@example.com');

        $this->withToken($token)->getJson('/api/admin/accounts/customer?search=existing-customer')
            ->assertOk()->assertJsonPath('data.0.UserID', $existingCustomer->UserID);

        $rider = $this->withToken($token)->postJson('/api/admin/accounts/driver', [
            'UserName' => 'Rider One', 'Email' => 'RIDER@example.com', 'Contact' => '09999999999',
            'Address' => 'Manila', 'password' => 'riderpass',
        ])->assertCreated()->assertJsonPath('Role', 'driver')->assertJsonPath('Email', 'rider@example.com')->json();

        $this->withToken($token)->getJson('/api/admin/accounts/driver?search=Rider')
            ->assertOk()->assertJsonPath('data.0.UserID', $rider['UserID']);
        $this->withToken($token)->putJson('/api/admin/accounts/driver/'.$rider['UserID'], [
            'UserName' => 'Rider Updated', 'Email' => 'rider@example.com', 'Contact' => '09888888888',
            'Address' => 'Makati',
        ])->assertOk()->assertJsonPath('UserName', 'Rider Updated');

        $customer = $this->withToken($token)->postJson('/api/admin/accounts/customer', [
            'UserName' => 'Customer One', 'Email' => 'customer@example.com', 'Contact' => '09777777777',
            'Address' => 'Pasig', 'password' => 'customerpass',
        ])->assertCreated()->assertJsonPath('Role', 'customer')->json();
        $this->withToken($token)->deleteJson('/api/admin/accounts/customer/'.$customer['UserID'])->assertOk();
        $this->assertDatabaseMissing('Users', ['UserID' => $customer['UserID']]);
    }

    public function test_only_admin_can_manage_accounts_and_roles_cannot_be_cross_managed(): void
    {
        $admin = $this->account('admin', 'admin@example.com');
        $customer = $this->account('customer', 'customer@example.com');
        $this->withToken($customer->createToken('test')->plainTextToken)
            ->getJson('/api/admin/accounts/customer')->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->withToken($admin->createToken('test')->plainTextToken)
            ->getJson('/api/admin/accounts/admin')->assertNotFound();
        $this->withToken($admin->createToken('test')->plainTextToken)
            ->putJson('/api/admin/accounts/driver/'.$customer->UserID, ['UserName' => 'Nope'])
            ->assertNotFound();
    }
}
