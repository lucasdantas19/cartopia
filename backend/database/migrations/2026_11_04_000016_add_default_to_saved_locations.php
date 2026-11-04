<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saved_locations', function (Blueprint $table): void {
            $table->boolean('is_default')->default(false)->after('longitude');
            $table->index(['user_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::table('saved_locations', function (Blueprint $table): void {
            $table->dropIndex('saved_locations_user_id_is_default_index');
            $table->dropColumn('is_default');
        });
    }
};
