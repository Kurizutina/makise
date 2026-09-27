<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Product', function (Blueprint $table) {
            // Stores the embedding vector as a JSON array of floats (no
            // dedicated vector column type in MySQL/MariaDB at this
            // version, and 599 products is small enough that a plain JSON
            // column + PHP-side cosine similarity needs no vector database).
            // Null until the backfill command runs against each product.
            $table->json('Embedding')->nullable()->after('Description');
        });
    }

    public function down(): void
    {
        Schema::table('Product', function (Blueprint $table) {
            $table->dropColumn('Embedding');
        });
    }
};
