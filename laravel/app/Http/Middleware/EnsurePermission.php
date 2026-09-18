<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $role = $request->user()?->Role;
        $permissions = config("permissions.roles.{$role}", []);
        if (!in_array($permission, $permissions, true)) {
            return response()->json(['error' => 'permission denied'], 403);
        }
        return $next($request);
    }
}
