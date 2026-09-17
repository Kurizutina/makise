<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Product', 'ImagePath')) {
            Schema::table('Product', fn (Blueprint $table) => $table->string('ImagePath', 500)->nullable()->after('ProductName'));
        }
    }

    public function down(): void {}
};
