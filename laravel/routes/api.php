<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AccountManagementController;
use App\Http\Controllers\CatalogController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/forgot-password', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:5,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');
Route::get('/catalog', [CatalogController::class, 'publicCatalog']);
Route::get('/catalog/brands/{brand}/products', [CatalogController::class, 'publicProducts']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/me', [AuthController::class, 'updateProfile']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/riders', function (Request $request) {
        if ($request->user()->Role !== 'admin') {
            return response()->json(['error' => 'admin access required'], 403);
        }
        return response()->json(['riders' => User::where('Role', 'driver')
            ->orderBy('UserName')->orderBy('UserID')->get(['UserID as id', 'UserName as name'])]);
    });
    Route::middleware('admin')->prefix('admin/catalog')->group(function () {
        Route::get('/options', [CatalogController::class, 'options']);
        Route::get('/services', [CatalogController::class, 'services']);
        Route::post('/services', [CatalogController::class, 'storeService']);
        Route::put('/services/{service}', [CatalogController::class, 'updateService']);
        Route::delete('/services/{service}', [CatalogController::class, 'destroyService']);
        Route::get('/brands', [CatalogController::class, 'brands']);
        Route::post('/brands', [CatalogController::class, 'storeBrand']);
        Route::put('/brands/{brand}', [CatalogController::class, 'updateBrand']);
        Route::delete('/brands/{brand}', [CatalogController::class, 'destroyBrand']);
        Route::get('/products', [CatalogController::class, 'products']);
        Route::post('/products', [CatalogController::class, 'storeProduct']);
        Route::put('/products/{product}', [CatalogController::class, 'updateProduct']);
        Route::delete('/products/{product}', [CatalogController::class, 'destroyProduct']);
    });
    Route::middleware('admin')->prefix('admin/accounts')->group(function () {
        Route::get('/{role}', [AccountManagementController::class, 'index']);
        Route::post('/{role}', [AccountManagementController::class, 'store']);
        Route::put('/{role}/{account}', [AccountManagementController::class, 'update']);
        Route::delete('/{role}/{account}', [AccountManagementController::class, 'destroy']);
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
