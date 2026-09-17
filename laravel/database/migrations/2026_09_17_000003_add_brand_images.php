<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Brands', 'ImagePath')) {
            Schema::table('Brands', fn (Blueprint $table) => $table->string('ImagePath', 500)->nullable()->after('BrandName'));
        }
    }

    public function down(): void {}
};
