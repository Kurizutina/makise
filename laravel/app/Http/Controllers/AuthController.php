<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetMail;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    // Well-known disposable/temporary-inbox domains, blocked at registration so
    // an account can't be thrown away the moment it's inconvenient (spam,
    // abuse, or just skirting the one-account-per-person assumption the rest
    // of the system relies on - e.g. duplicate-email rejection below only
    // works against a real, ownable inbox). Not exhaustive - new disposable
    // services appear constantly - but it stops the mass-produced/dummy
    // accounts that use a handful of well-known, widely-abused providers.
    // Deliberately not a full email-verification flow (send-a-link-and-wait):
    // that needs a real SMTP sender configured (MAIL_PASSWORD is blank in
    // .env.example), which isn't this project's call to make unilaterally.
    private const DISPOSABLE_EMAIL_DOMAINS = [
        'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', '10minutemail.com',
        'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'yopmail.com', 'trashmail.com',
        'getnada.com', 'fakeinbox.com', 'dispostable.com', 'sharklasers.com', 'mintemail.com',
        'maildrop.cc', 'mailnesia.com', 'mailcatch.com', 'mohmal.com', 'moakt.com',
        'discard.email', 'emailondeck.com', 'spamgourmet.com', 'mytemp.email', 'tempinbox.com',
    ];

    private function isDisposableEmail(string $email): bool
    {
        $domain = strtolower(substr(strrchr($email, '@'), 1));
        return in_array($domain, self::DISPOSABLE_EMAIL_DOMAINS, true);
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'password' => ['required', 'string', 'min:6', 'max:72'],
            'userType' => ['required', 'in:student,non_student'],
            'username' => ['required', 'string', 'max:100'],
            'contact' => ['required', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);
        $email = strtolower(trim($data['email']));
        if ($this->isDisposableEmail($email)) {
            return response()->json(['error' => 'Please use a real, permanent email address to register.'], 422);
        }
        if (User::where('Email', $email)->exists()) {
            return response()->json(['error' => 'email is already registered'], 409);
        }
        try {
            return DB::transaction(function () use ($data, $email) {
                $user = User::create([
                    'UserName' => trim($data['username']), 'Contact' => trim($data['contact']),
                    'Role' => 'customer', 'UserType' => $data['userType'], 'Email' => $email,
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
        ]);
        $user = User::where('Email', strtolower(trim($data['email'])))->first();
        // Accept existing bcryptjs $2b$ hashes as well as Laravel hashes.
        if (!$user || !password_verify($data['password'], $user->PasswordHash)) {
            return response()->json(['error' => 'invalid credentials'], 401);
        }
        return $this->authenticated($user);
    }

    public function requestPasswordReset(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:255']]);
        $email = strtolower(trim($data['email']));
        $user = User::where('Email', $email)->first();

        if ($user) {
            $token = Str::random(64);
            DB::table('password_reset_tokens')->where('email', $email)->delete();
            DB::table('password_reset_tokens')->insert([
                'email' => $email,
                'token' => hash('sha256', $token),
                'created_at' => now(),
            ]);

            $resetUrl = rtrim((string) config('otuzan.frontend_url'), '/')
                .'/reset-password?token='.urlencode($token).'&email='.urlencode($email);
            Mail::to($email)->send(new PasswordResetMail($resetUrl));
        }

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:6', 'max:72'],
        ]);
        $email = strtolower(trim($data['email']));
        $reset = DB::table('password_reset_tokens')->where('email', $email)->first();

        if (!$reset || now()->subMinutes(60)->greaterThan($reset->created_at)
            || !hash_equals($reset->token, hash('sha256', $data['token']))) {
            return response()->json(['error' => 'This password reset link is invalid or expired.'], 422);
        }

        $user = User::where('Email', $email)->first();
        if (!$user) {
            return response()->json(['error' => 'This password reset link is invalid or expired.'], 422);
        }

        $user->update(['PasswordHash' => Hash::make($data['password'])]);
        DB::table('password_reset_tokens')->where('email', $email)->delete();

        return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
    }

    private function authenticated(User $user, int $status = 200): JsonResponse
    {
        $token = $user->createToken('dashboard', ['*'], now()->addHours(2))->plainTextToken;
        return response()->json([
            'user' => $user->profile(),
            'token' => $token,
            'mustChangePassword' => (bool) $user->MustChangePassword,
        ], $status);
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

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'currentPassword' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
        ]);
        $user = $request->user();
        if (!password_verify($data['currentPassword'], $user->PasswordHash)) {
            return response()->json(['error' => 'The current password is incorrect.'], 422);
        }
        $user->update(['PasswordHash' => Hash::make($data['password']), 'MustChangePassword' => false]);
        return response()->json(['message' => 'Your password has been changed.']);
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
