<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Users', 'MustChangePassword')) {
            Schema::table('Users', function (Blueprint $table) {
                $table->boolean('MustChangePassword')->default(false);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('Users', 'MustChangePassword')) {
            Schema::table('Users', fn (Blueprint $table) => $table->dropColumn('MustChangePassword'));
        }
    }
};