<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Orders', function (Blueprint $table) {
            // Signed int(11) to match the live Users.UserID/Orders.UserID columns
            // exactly (imported from the original SQL dump, not the unsignedInteger
            // this migration file's sibling declares - that guard never actually ran
            // against this database since the table already existed).
            $table->integer('AssignedRiderID')->nullable()->after('UserID');
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
