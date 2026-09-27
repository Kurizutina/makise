<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('Product', 'StockQuantity')) {
            Schema::table('Product', function (Blueprint $table) {
                $table->dropColumn('StockQuantity');
            });
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('Product', 'StockQuantity')) {
            Schema::table('Product', function (Blueprint $table) {
                $table->unsignedInteger('StockQuantity')->default(0);
            });
        }
    }
};
