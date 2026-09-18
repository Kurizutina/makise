<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('Brands')) {
            DB::table('Brands')->whereIn('BrandName', ["Elena's", 'ButterLand'])->update(['IsActive' => false]);
        }
    }

    public function down(): void
    {
        // Do not automatically republish retired brands on rollback.
    }
};
