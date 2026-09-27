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
            'contact' => '09123456789', 'address' => '12 Mabini Street', 'userType' => 'non_student',
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

    public function test_registration_rejects_known_disposable_email_domains(): void
    {
        $data = [
            'username' => 'Throwaway', 'email' => 'someone@mailinator.com', 'password' => 'secret123',
            'contact' => '09123456789', 'userType' => 'non_student',
        ];
        $this->postJson('/api/auth/register', $data)->assertUnprocessable()
            ->assertJsonStructure(['error']);
        $this->assertDatabaseMissing('Users', ['Email' => 'someone@mailinator.com']);
        // Case-insensitive and mixed-case domain both caught, not just the exact lowercase form.
        $data['email'] = 'Someone@MAILINATOR.com';
        $this->postJson('/api/auth/register', $data)->assertUnprocessable();
        // A real domain that merely contains a blocked one as a substring must not be caught.
        $data['email'] = 'someone@notmailinator.com';
        $this->postJson('/api/auth/register', $data)->assertCreated();
    }

    public function test_login_accepts_migrated_bcryptjs_password_hash_and_uses_the_account_role(): void
    {
        $user = $this->account();
        $user->update(['PasswordHash' => '$2b$'.substr($user->PasswordHash, 4)]);
        $this->postJson('/api/auth/login', [
            'email' => $user->Email, 'password' => 'secret123',
        ])->assertOk()->assertJsonPath('user.id', $user->UserID)
            ->assertJsonPath('user.role', 'customer');
        $this->postJson('/api/auth/login', [
            'email' => $user->Email, 'password' => 'wrong-password',
        ])->assertUnauthorized();
    }

    public function test_public_rider_registration_is_blocked_and_admin_created_rider_can_login(): void
    {
        $data = ['username' => 'Rider', 'email' => 'rider@example.com', 'password' => 'secret123',
            'role' => 'driver', 'contact' => '09123456789'];
        $this->postJson('/api/auth/register', $data)->assertUnprocessable();

        $admin = $this->account('admin');
        $adminToken = $admin->createToken('test')->plainTextToken;
        $rider = $this->withToken($adminToken)->postJson('/api/admin/accounts/driver', [
            'UserName' => 'Rider', 'Email' => 'rider@example.com', 'Contact' => '09123456789',
            'password' => 'secret123',
        ])->assertCreated()->assertJsonPath('Role', 'driver')->json();

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/auth/login', [
            'email' => $rider['Email'], 'password' => 'secret123',
        ])->assertOk()->assertJsonPath('user.role', 'driver');
        $this->postJson('/api/auth/register', ['role' => 'superadmin'])->assertUnprocessable()
            ->assertJsonStructure(['error']);
    }

    public function test_password_reset_request_sends_a_generic_reset_message(): void
    {
        $user = $this->account();

        $this->postJson('/api/auth/forgot-password', ['email' => $user->Email])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');

        $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->Email]);
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
