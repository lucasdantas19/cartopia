<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->timestampTz('opened_at')->nullable();
            $table->string('sender_access_token_hash', 64)->nullable();
            $table->index('sender_access_token_hash');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex(['sender_access_token_hash']);
            $table->dropColumn(['opened_at', 'sender_access_token_hash']);
        });
    }
};
