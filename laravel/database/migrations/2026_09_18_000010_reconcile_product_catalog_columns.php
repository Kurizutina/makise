<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Product', 'BrandID')) {
            Schema::table('Product', function (Blueprint $table) {
                $table->unsignedInteger('BrandID')->nullable()->after('ProductID');
                $table->foreign('BrandID')->references('BrandID')->on('Brands')->restrictOnDelete();
                $table->index('BrandID');
            });
        }
        if (!Schema::hasColumn('Product', 'ImagePath')) {
            Schema::table('Product', fn (Blueprint $table) => $table->string('ImagePath', 500)->nullable()->after('ProductName'));
        }
        if (!Schema::hasColumn('Product', 'Description')) {
            Schema::table('Product', fn (Blueprint $table) => $table->string('Description', 500)->nullable());
        }
        if (!Schema::hasColumn('Product', 'IsActive')) {
            Schema::table('Product', fn (Blueprint $table) => $table->boolean('IsActive')->default(true));
        }
    }

    public function down(): void
    {
        // Preserve catalog data if this compatibility migration is rolled back.
    }
};