<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('Services', function (Blueprint $table) {
            $table->increments('ServiceID');
            $table->string('ServiceName', 100)->unique();
            $table->string('Description', 500)->nullable();
            $table->boolean('IsActive')->default(true);
            $table->timestamps();
        });

        Schema::create('Brands', function (Blueprint $table) {
            $table->increments('BrandID');
            $table->unsignedInteger('ServiceID')->nullable();
            $table->string('BrandName', 150)->unique();
            $table->string('Description', 500)->nullable();
            $table->boolean('IsActive')->default(true);
            $table->timestamps();
            $table->foreign('ServiceID')->references('ServiceID')->on('Services')->nullOnDelete();
            $table->index('ServiceID');
        });

        if (!Schema::hasColumn('Product', 'BrandID')) {
            Schema::table('Product', function (Blueprint $table) {
                // Nullable only to preserve pre-existing inventory. All new and edited
                // catalog products are required by the API to select a brand.
                $table->unsignedInteger('BrandID')->nullable()->after('ProductID');
                $table->foreign('BrandID')->references('BrandID')->on('Brands')->restrictOnDelete();
                $table->index('BrandID');
            });
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
        // Catalog entries can be referenced by order inventory; preserve data on rollback.
    }
};
