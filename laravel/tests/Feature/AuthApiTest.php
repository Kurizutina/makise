<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $role = 'customer'): User
    {
        return User::create([
            'UserName' => 'Test '.$role, 'Email' => $role.'@example.com', 'Role' => $role,
            'Contact' => '09123456789', 'PasswordHash' => Hash::make('secret123'),
        ]);
    }

    public function test_registration_persists_account_address_and_returns_compatible_token(): void
    {
        $data = [
            'username' => 'Ana Cruz', 'email' => 'ANA@example.com', 'password' => 'secret123',
            'role' => 'customer', 'contact' => '09123456789', 'address' => '12 Mabini Street',
        ];
        $response = $this->withHeader('Origin', 'http://localhost:3000')->postJson('/api/auth/register', $data)
            ->assertCreated()->assertJsonPath('user.email', 'ana@example.com')
            ->assertJsonPath('user.address', '12 Mabini Street')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        $user = User::firstOrFail();
        $this->assertTrue(Hash::check('secret123', $user->PasswordHash));
        $this->assertArrayNotHasKey('PasswordHash', $response->json('user'));
        $this->withToken($response->json('token'))->getJson('/api/auth/me')
            ->assertOk()->assertJsonPath('user.id', $user->UserID);
        $this->postJson('/api/auth/register', $data)->assertConflict();
    }

    public function test_login_accepts_migrated_bcryptjs_password_hash_and_preserves_id(): void
    {
        $user = $this->account();
        $user->update(['PasswordHash' => '$2b$'.substr($user->PasswordHash, 4)]);
        $this->postJson('/api/auth/login', [
            'email' => $user->Email, 'password' => 'secret123', 'role' => 'customer',
        ])->assertOk()->assertJsonPath('user.id', $user->UserID);
        $this->postJson('/api/auth/login', [
            'email' => $user->Email, 'password' => 'wrong-password', 'role' => 'customer',
        ])->assertUnauthorized();
        $this->postJson('/api/auth/login', [
            'email' => $user->Email, 'password' => 'secret123', 'role' => 'admin',
        ])->assertUnauthorized();
    }

    public function test_staff_registration_requires_correct_access_code(): void
    {
        $data = ['username' => 'Rider', 'email' => 'rider@example.com', 'password' => 'secret123',
            'role' => 'driver', 'contact' => '09123456789'];
        $this->postJson('/api/auth/register', $data)->assertStatus(400);
        $this->postJson('/api/auth/register', $data + ['accessCode' => config('otuzan.access_codes.driver')])
            ->assertCreated()->assertJsonPath('user.role', 'driver');
        $this->postJson('/api/auth/register', ['role' => 'superadmin'])->assertUnprocessable()
            ->assertJsonStructure(['error']);
    }

    public function test_only_admin_can_list_registered_drivers(): void
    {
        $driver = $this->account('driver');
        $admin = $this->account('admin');
        $this->getJson('/api/riders')->assertUnauthorized();
        $this->withToken($driver->createToken('test')->plainTextToken)->getJson('/api/riders')->assertForbidden();
        // Reset the cached guard between requests with different identities.
        $this->app['auth']->forgetGuards();
        $this->withToken($admin->createToken('test')->plainTextToken)->getJson('/api/riders')
            ->assertOk()->assertExactJson(['riders' => [['id' => $driver->UserID, 'name' => $driver->UserName]]]);
    }

    public function test_expired_and_revoked_tokens_cannot_access_accounts(): void
    {
        $user = $this->account();
        $expired = $user->createToken('expired', ['*'], now()->subMinute())->plainTextToken;
        $this->withToken($expired)->getJson('/api/auth/me')->assertUnauthorized();
        $token = $user->createToken('valid')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }
}
