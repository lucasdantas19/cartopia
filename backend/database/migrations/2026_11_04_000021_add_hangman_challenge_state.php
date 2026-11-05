<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->text('unlock_answer_encrypted')->nullable()->after('unlock_answer_hash');
            $table->json('unlock_state')->nullable()->after('unlock_attempts');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn(['unlock_answer_encrypted', 'unlock_state']);
        });
    }
};
