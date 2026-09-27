<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Orders', function (Blueprint $table) {
            // Some supported merchants use a static/custom menu rather than
            // rows in Product. Preserve a safe order snapshot for those
            // orders so they enter the same admin/rider workflow as catalog
            // orders instead of being stranded in a customer's browser.
            $table->json('OrderSnapshot')->nullable()->after('DeliveryAddress');
        });
    }

    public function down(): void
    {
        Schema::table('Orders', function (Blueprint $table) {
            $table->dropColumn('OrderSnapshot');
        });
    }
};
