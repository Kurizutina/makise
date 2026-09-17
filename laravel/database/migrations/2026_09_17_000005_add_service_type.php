<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Services', 'ServiceType')) {
            Schema::table('Services', fn (Blueprint $table) => $table->string('ServiceType', 20)->default('item'));
        }
        foreach (['Food Delivery' => 'food', 'Item Delivery' => 'item', 'Pay Bills' => 'bills'] as $name => $type) {
            DB::table('Services')->where('ServiceName', $name)->update(['ServiceType' => $type]);
        }
    }

    public function down(): void {}
};
