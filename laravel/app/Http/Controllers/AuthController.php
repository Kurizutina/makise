<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:6', 'max:72'],
            'role' => ['required', Rule::in(['customer', 'driver', 'admin'])],
            'username' => ['required', 'string', 'max:100'],
            'contact' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:2000'],
            'accessCode' => ['nullable', 'string'],
        ]);
        if ($data['role'] !== 'customer' && !hash_equals(
            (string) config('otuzan.access_codes.'.$data['role']), (string) ($data['accessCode'] ?? '')
        )) {
            return response()->json(['error' => 'invalid access code'], 400);
        }
        $email = strtolower(trim($data['email']));
        if (User::where('Email', $email)->exists()) {
            return response()->json(['error' => 'email is already registered'], 409);
        }
        try {
            return DB::transaction(function () use ($data, $email) {
                $user = User::create([
                    'UserName' => trim($data['username']), 'Contact' => trim($data['contact']),
                    'Role' => $data['role'], 'Email' => $email,
                    'PasswordHash' => Hash::make($data['password']), 'Address' => $data['address'] ?? null,
                ]);
                return $this->authenticated($user, 201);
            });
        } catch (UniqueConstraintViolationException $error) {
            return response()->json(['error' => 'email is already registered'], 409);
        }
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'], 'password' => ['required', 'string'],
            'role' => ['required', Rule::in(['customer', 'driver', 'admin'])],
        ]);
        $user = User::where('Email', strtolower(trim($data['email'])))->first();
        // Accept existing bcryptjs $2b$ hashes as well as Laravel hashes.
        if (!$user || $user->Role !== $data['role'] || !password_verify($data['password'], $user->PasswordHash)) {
            return response()->json(['error' => 'invalid credentials'], 401);
        }
        return $this->authenticated($user);
    }

    private function authenticated(User $user, int $status = 200): JsonResponse
    {
        $token = $user->createToken('dashboard', ['*'], now()->addHours(2))->plainTextToken;
        return response()->json(['user' => $user->profile(), 'token' => $token], $status);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $request->user()->profile()]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['status' => 'ok']);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'address' => ['required', 'string', 'max:2000'],
            'password' => ['nullable', 'string', 'min:6', 'max:72'],
        ], [], ['username' => 'full name']);
        $user = $request->user();
        $email = strtolower(trim($data['email']));
        if (User::where('Email', $email)->where('UserID', '!=', $user->UserID)->exists()) {
            return response()->json(['error' => 'email is already registered'], 409);
        }
        $changes = [
            'UserName' => trim($data['username']), 'Email' => $email,
            'Address' => trim($data['address']),
        ];
        if (!empty($data['password'])) $changes['PasswordHash'] = Hash::make($data['password']);
        try {
            $user->update($changes);
        } catch (UniqueConstraintViolationException $error) {
            return response()->json(['error' => 'email is already registered'], 409);
        }
        return response()->json(['user' => $user->fresh()->profile()]);
    }
}
