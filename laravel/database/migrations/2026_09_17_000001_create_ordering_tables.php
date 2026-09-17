<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('Product')) {
            Schema::create('Product', function (Blueprint $table) {
                $table->increments('ProductID');
                $table->string('ProductName', 150);
                $table->decimal('ProductPrice', 10, 2);
            });
        }

        if (!Schema::hasTable('Orders')) {
            Schema::create('Orders', function (Blueprint $table) {
                $table->increments('OrderID');
                $table->unsignedInteger('UserID');
                $table->decimal('TotalPrice', 10, 2);
                $table->dateTime('OrderDate')->useCurrent();
                $table->text('DeliveryAddress')->nullable();
                $table->string('DeliveryStatus', 50)->default('pending');
                $table->foreign('UserID')->references('UserID')->on('Users')->cascadeOnUpdate()->cascadeOnDelete();
                $table->index('DeliveryStatus');
            });
        }

        if (!Schema::hasTable('OrderItem')) {
            Schema::create('OrderItem', function (Blueprint $table) {
                $table->increments('OrderItemID');
                $table->unsignedInteger('ProductID');
                $table->unsignedInteger('OrderID');
                $table->decimal('OrderItemPrice', 10, 2);
                $table->unsignedInteger('ProductQuantity');
                $table->foreign('ProductID')->references('ProductID')->on('Product')->cascadeOnUpdate()->restrictOnDelete();
                $table->foreign('OrderID')->references('OrderID')->on('Orders')->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('Payment')) {
            Schema::create('Payment', function (Blueprint $table) {
                $table->increments('PaymentID');
                $table->unsignedInteger('OrderID');
                $table->string('PaymentName', 100)->nullable();
                $table->string('PaymentMethod', 50)->nullable();
                $table->decimal('PaymentAmount', 10, 2);
                $table->string('PaymentStatus', 50)->default('pending');
                $table->text('PaymentNote')->nullable();
                $table->foreign('OrderID')->references('OrderID')->on('Orders')->cascadeOnUpdate()->cascadeOnDelete();
            });
        }

        if (!Schema::hasTable('Queue')) {
            Schema::create('Queue', function (Blueprint $table) {
                $table->increments('QueueID');
                $table->unsignedInteger('OrderID');
                $table->unsignedInteger('QueuePosition')->nullable();
                $table->string('QueueStatus', 50)->default('waiting');
                $table->dateTime('QueueDate')->useCurrent();
                $table->foreign('OrderID')->references('OrderID')->on('Orders')->cascadeOnUpdate()->cascadeOnDelete();
                $table->index(['QueueStatus', 'QueuePosition']);
            });
        }

        if (!Schema::hasTable('Notification')) {
            Schema::create('Notification', function (Blueprint $table) {
                $table->increments('NotificationID');
                $table->unsignedInteger('UserID');
                $table->text('NotificationMessage');
                $table->boolean('NotificationSeen')->default(false);
                $table->dateTime('NotificationDate')->useCurrent();
                $table->foreign('UserID')->references('UserID')->on('Users')->cascadeOnUpdate()->cascadeOnDelete();
                $table->index(['UserID', 'NotificationSeen']);
            });
        }
    }

    public function down(): void
    {
        // These tables may have been imported before Laravel was introduced; preserve existing data on rollback.
    }
};
