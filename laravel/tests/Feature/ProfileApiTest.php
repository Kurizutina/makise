<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_updates_only_authenticated_account_and_preserves_blank_password(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $oldHash = $user->PasswordHash;
        $this->withToken($user->createToken('test')->plainTextToken)->patchJson('/api/auth/me', [
            'username' => 'New Full Name', 'email' => 'NEW@example.com', 'address' => 'New Address',
            'password' => '', 'id' => $other->UserID, 'role' => 'admin',
        ])->assertOk()->assertJsonPath('user.id', $user->UserID)->assertJsonPath('user.role', 'customer');
        $this->assertDatabaseHas('Users', ['UserID' => $user->UserID, 'UserName' => 'New Full Name', 'Email' => 'new@example.com', 'Address' => 'New Address']);
        $this->assertSame($oldHash, $user->fresh()->PasswordHash);
        $this->assertSame($other->UserName, $other->fresh()->UserName);
    }

    public function test_password_change_is_hashed_and_used_on_next_login(): void
    {
        $user = User::factory()->create();
        $this->withToken($user->createToken('test')->plainTextToken)->patchJson('/api/auth/me', [
            'username' => 'Updated Name', 'email' => 'updated@example.com', 'address' => 'New Address', 'password' => 'changed123',
        ])->assertOk()->assertJsonMissingPath('user.password')->assertJsonMissingPath('user.PasswordHash');
        $this->assertTrue(Hash::check('changed123', $user->fresh()->PasswordHash));
        $this->postJson('/api/auth/login', ['email' => 'updated@example.com', 'password' => 'changed123', 'role' => 'customer'])->assertOk();
        $this->postJson('/api/auth/login', ['email' => 'updated@example.com', 'password' => 'password', 'role' => 'customer'])->assertUnauthorized();
    }

    public function test_unauthenticated_duplicate_and_invalid_updates_do_not_change_profile(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $data = ['username' => 'New Name', 'email' => $other->Email, 'address' => 'New Address'];
        $this->patchJson('/api/auth/me', $data)->assertUnauthorized();
        $this->withToken($user->createToken('test')->plainTextToken)->patchJson('/api/auth/me', $data)->assertConflict();
        $this->patchJson('/api/auth/me', ['username' => ' ', 'email' => 'invalid', 'address' => ''])->assertUnprocessable();
        $this->assertSame($user->UserName, $user->fresh()->UserName);
        $this->assertSame($user->Email, $user->fresh()->Email);
    }
}
