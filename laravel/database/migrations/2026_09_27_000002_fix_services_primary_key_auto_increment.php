<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // The original deployment predated Laravel's catalog migration and
        // has a Services.ServiceID primary key without AUTO_INCREMENT. New
        // services then fail with MySQL error 1364 because Eloquent correctly
        // omits a value for an incrementing key. Keep the installed column
        // type intact (it may be signed in an older database) and add only
        // the missing generation behavior.
        if (DB::getDriverName() !== 'mysql') return;

        $column = DB::selectOne(
            "SELECT COLUMN_TYPE AS column_type, EXTRA AS extra\n             FROM information_schema.COLUMNS\n             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Services' AND COLUMN_NAME = 'ServiceID'"
        );
        if (!$column || str_contains(strtolower($column->extra), 'auto_increment')) return;

        DB::statement("ALTER TABLE `Services` MODIFY `ServiceID` {$column->column_type} NOT NULL AUTO_INCREMENT");
    }

    public function down(): void
    {
        // Keep generated IDs intact on rollback; removing AUTO_INCREMENT
        // would make future service creation fail again.
    }
};
