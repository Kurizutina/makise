<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class AccountManagementController extends Controller
{
    public function index(Request $request, string $role): JsonResponse
    {
        $this->ensureManagedRole($role);
        $query = User::query()->where('Role', $role)->orderBy('UserName')->orderBy('UserID');
        $search = trim((string) $request->query('search'));

        if ($search !== '') {
            $query->where(function ($users) use ($search) {
                $users->where('UserName', 'like', "%{$search}%")
                    ->orWhere('Email', 'like', "%{$search}%")
                    ->orWhere('Contact', 'like', "%{$search}%")
                    ->orWhere('Address', 'like', "%{$search}%");
            });
        }

        $perPage = min(max((int) $request->query('per_page', 10), 1), 50);
        return response()->json($query->paginate($perPage, [
            'UserID', 'UserName', 'Contact', 'Role', 'Email', 'Address', 'CreatedAt',
        ]));
    }

    public function store(Request $request, string $role): JsonResponse
    {
        $this->ensureManagedRole($role);
        $data = $this->accountData($request);
        $data['Role'] = $role;
        $data['PasswordHash'] = Hash::make($data['password']);
        $data['MustChangePassword'] = false;
        unset($data['password']);

        $account = User::create($data);
        return response()->json($this->accountResponse($account), 201);
    }

    public function update(Request $request, string $role, User $account): JsonResponse
    {
        $this->ensureAccountRole($role, $account);
        $data = $this->accountData($request, $account, true);
        if (array_key_exists('password', $data)) {
            if ($data['password'] !== '') $data['PasswordHash'] = Hash::make($data['password']);
            unset($data['password']);
        }
        $account->update($data);
        return response()->json($this->accountResponse($account->fresh()));
    }

    public function destroy(Request $request, string $role, User $account): JsonResponse
    {
        $this->ensureAccountRole($role, $account);
        if ($request->user()->UserID === $account->UserID) {
            return response()->json(['error' => 'You cannot delete your own account.'], 422);
        }
        $account->delete();
        return response()->json(['status' => 'deleted']);
    }

    private function accountData(Request $request, ?User $account = null, bool $partial = false): array
    {
        $passwordRules = $partial
            ? ['nullable', 'string', 'min:6', 'max:72']
            : ['required', 'string', 'min:6', 'max:72'];
        $emailRule = Rule::unique('Users', 'Email');
        if ($account) $emailRule->ignore($account->UserID, 'UserID');

        $data = $request->validate([
            'UserName' => [$partial ? 'sometimes' : 'required', 'string', 'max:100'],
            'Email' => [$partial ? 'sometimes' : 'required', 'email', 'max:255', $emailRule],
            'Contact' => [$partial ? 'sometimes' : 'required', 'string', 'max:50'],
            'Address' => ['nullable', 'string', 'max:2000'],
            'password' => $passwordRules,
        ]);

        if (array_key_exists('UserName', $data)) $data['UserName'] = trim($data['UserName']);
        if (array_key_exists('Email', $data)) $data['Email'] = strtolower(trim($data['Email']));
        if (array_key_exists('Contact', $data)) $data['Contact'] = trim($data['Contact']);
        if (array_key_exists('Address', $data)) $data['Address'] = trim((string) $data['Address']) ?: null;
        return $data;
    }

    private function accountResponse(User $account): array
    {
        return $account->only(['UserID', 'UserName', 'Contact', 'Role', 'Email', 'Address', 'CreatedAt']);
    }

    private function ensureManagedRole(string $role): void
    {
        abort_unless(in_array($role, ['driver', 'customer'], true), 404);
    }

    private function ensureAccountRole(string $role, User $account): void
    {
        $this->ensureManagedRole($role);
        abort_unless($account->Role === $role, 404);
    }
}
