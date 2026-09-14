<?php

use App\Http\Controllers\AuthController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/riders', function (Request $request) {
        if ($request->user()->Role !== 'admin') {
            return response()->json(['error' => 'admin access required'], 403);
        }
        return response()->json(['riders' => User::where('Role', 'driver')
            ->orderBy('UserName')->orderBy('UserID')->get(['UserID as id', 'UserName as name'])]);
    });
});
Route::get('/health', fn () => response()->json(['status' => 'ok', 'backend' => 'laravel']));
Route::get('/health/db', function () {
    try {
        DB::select('SELECT 1');
        return response()->json(['status' => 'connected', 'database' => config('database.connections.mysql.database'), 'backend' => 'laravel']);
    } catch (Throwable $error) {
        report($error);
        return response()->json(['status' => 'disconnected'], 503);
    }
});
