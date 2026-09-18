<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\EnsureAdmin::class,
            'permission' => \App\Http\Middleware\EnsurePermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn ($request) => $request->is('api/*') || $request->expectsJson());
        $exceptions->render(function (\Illuminate\Validation\ValidationException $error, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['error' => collect($error->errors())->flatten()->first()], 422);
            }
        });
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $error, \Illuminate\Http\Request $request) {
            if ($request->is('api/*')) return response()->json(['error' => 'authentication required'], 401);
        });
    })->create();
