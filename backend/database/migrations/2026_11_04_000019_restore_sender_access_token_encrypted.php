<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('deliveries', 'sender_access_token_encrypted')) {
            Schema::table('deliveries', function (Blueprint $table): void {
                $table->text('sender_access_token_encrypted')->nullable()->after('sender_access_token_hash');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('deliveries', 'sender_access_token_encrypted')) {
            Schema::table('deliveries', function (Blueprint $table): void {
                $table->dropColumn('sender_access_token_encrypted');
            });
        }
    }
};
