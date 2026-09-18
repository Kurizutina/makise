<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Users', 'Address')) {
            Schema::table('Users', function (Blueprint $table) {
                $table->text('Address')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('Users', 'Address')) {
            Schema::table('Users', function (Blueprint $table) {
                $table->dropColumn('Address');
            });
        }
    }
};