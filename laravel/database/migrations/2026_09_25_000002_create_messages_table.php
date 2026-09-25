<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('Message', function (Blueprint $table) {
            $table->increments('MessageID');
            // Signed, matching the live Orders.OrderID/Users.UserID columns
            // exactly (both int(11) signed in practice, despite some other
            // migrations declaring unsignedInteger) - MySQL/MariaDB requires
            // exact type+signedness match to form a foreign key.
            $table->integer('OrderID');
            $table->integer('SenderUserID');
            $table->string('MessageBody', 1000);
            $table->boolean('MessageSeen')->default(false);
            $table->dateTime('MessageDate');
            $table->foreign('OrderID')->references('OrderID')->on('Orders')->cascadeOnDelete();
            $table->foreign('SenderUserID')->references('UserID')->on('Users')->cascadeOnDelete();
            $table->index(['OrderID', 'MessageDate']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('Message');
    }
};
