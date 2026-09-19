<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('Users', 'UserType')) {
            Schema::table('Users', function (Blueprint $table) {
                $table->string('UserType', 20)->default('non_student')->after('Role');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('Users', 'UserType')) Schema::table('Users', fn (Blueprint $table) => $table->dropColumn('UserType'));
    }
};
