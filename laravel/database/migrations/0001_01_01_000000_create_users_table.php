<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Adopt the existing application table without replacing accounts or IDs.
        if (!Schema::hasTable('Users')) {
            Schema::create('Users', function (Blueprint $table) {
                $table->increments('UserID');
                $table->string('UserName', 100);
                $table->string('Contact', 50)->nullable();
                $table->string('Role', 50);
                $table->string('Email')->unique();
                $table->string('PasswordHash');
                $table->timestamp('CreatedAt')->useCurrent();
            });
        }
        if (!Schema::hasColumn('Users', 'Address')) {
            Schema::table('Users', fn (Blueprint $table) => $table->text('Address')->nullable());
        }
    }

    public function down(): void
    {
        // The adopted Users table may predate Laravel; never drop it on rollback.
    }
};
