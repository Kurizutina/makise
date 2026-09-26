<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\AccountManagementController;
use App\Http\Controllers\CatalogController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PaymentController;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::post('/auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('/auth/forgot-password', [AuthController::class, 'requestPasswordReset'])->middleware('throttle:5,1');
Route::post('/auth/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:10,1');
Route::get('/catalog', [CatalogController::class, 'publicCatalog']);
Route::get('/catalog/brands/{brand}/products', [CatalogController::class, 'publicProducts']);
Route::get('/catalog/best-sellers', [CatalogController::class, 'bestSellers']);
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/me', [AuthController::class, 'updateProfile']);
    Route::post('/auth/change-password', [AuthController::class, 'changePassword']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/uploads/bill-documents', function (Request $request) {
        abort_unless($request->user()->Role === 'customer', 403);
        $data = $request->validate(['document' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,gif,pdf', 'max:10240']]);
        $file = $data['document'];
        $directory = public_path('uploads/bill-documents');
        if (!is_dir($directory)) mkdir($directory, 0755, true);
        $filename = Str::uuid()->toString().'.'.$file->extension();
        $file->move($directory, $filename);
        return response()->json(['url' => '/uploads/bill-documents/'.$filename, 'name' => $file->getClientOriginalName()], 201);
    })->middleware('throttle:20,1');
    Route::post('/orders', [OrderController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/orders', [OrderController::class, 'index']);
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus']);
    Route::post('/payments', [PaymentController::class, 'store'])->middleware('throttle:20,1');
    Route::get('/orders/{order}/messages', [MessageController::class, 'index']);
    Route::post('/orders/{order}/messages', [MessageController::class, 'store'])->middleware('throttle:30,1');
    Route::patch('/orders/{order}/messages/read', [MessageController::class, 'markRead']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read', [NotificationController::class, 'markAllRead']);
    Route::middleware('permission:orders.manage')->group(function () {
        Route::get('/admin/orders', [OrderController::class, 'indexAll']);
        Route::get('/admin/revenue', [OrderController::class, 'revenue']);
        Route::get('/admin/customer-segments', [OrderController::class, 'customerSegments']);
        Route::patch('/orders/{order}/assign', [OrderController::class, 'assign']);
        Route::patch('/payments/{payment}/status', [PaymentController::class, 'updateStatus']);
    });
    Route::middleware('permission:riders.view')->get('/riders', function (Request $request) {
        return response()->json(['riders' => User::where('Role', 'driver')
            ->orderBy('UserName')->orderBy('UserID')->get(['UserID as id', 'UserName as name'])]);
    });
    Route::middleware('permission:catalog.manage')->prefix('admin/catalog')->group(function () {
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
        Route::get('/categories', [CatalogController::class, 'categories']);
        Route::post('/products', [CatalogController::class, 'storeProduct']);
        Route::put('/products/{product}', [CatalogController::class, 'updateProduct']);
        Route::delete('/products/{product}', [CatalogController::class, 'destroyProduct']);
    });
    Route::middleware('permission:accounts.manage')->prefix('admin/accounts')->group(function () {
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
