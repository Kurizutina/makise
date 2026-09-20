<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Users.UserID is a plain signed int(11) on a database set up by importing
        // the team's shared SQL dump, but unsigned when created fresh by Laravel's
        // own increments() helper (see 0001_01_01_000000_create_users_table.php).
        // A foreign key requires an exact type match, so detect which this database
        // actually has instead of assuming one - otherwise this migration only
        // works on whichever setup path it happened to be written against.
        $usersIdIsUnsigned = true;
        if (Schema::getConnection()->getDriverName() === 'mysql') {
            $column = DB::select("SHOW COLUMNS FROM Users WHERE Field = 'UserID'")[0] ?? null;
            $usersIdIsUnsigned = $column ? str_contains(strtolower($column->Type), 'unsigned') : true;
        }

        Schema::table('Orders', function (Blueprint $table) use ($usersIdIsUnsigned) {
            $column = $usersIdIsUnsigned
                ? $table->unsignedInteger('AssignedRiderID')
                : $table->integer('AssignedRiderID');
            $column->nullable()->after('UserID');
            $table->foreign('AssignedRiderID')->references('UserID')->on('Users')->nullOnDelete();
            $table->index('AssignedRiderID');
        });
    }

    public function down(): void
    {
        Schema::table('Orders', function (Blueprint $table) {
            $table->dropForeign(['AssignedRiderID']);
            $table->dropColumn('AssignedRiderID');
        });
    }
};
