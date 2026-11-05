<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('unlock_type')->default('none')->after('delivery_mode');
            $table->string('unlock_answer_hash')->nullable()->after('unlock_type');
            $table->unsignedSmallInteger('unlock_attempts')->default(0)->after('unlock_answer_hash');
            $table->timestampTz('unlocked_at')->nullable()->after('unlock_attempts');
        });
    }

    public function down(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropColumn(['unlock_type', 'unlock_answer_hash', 'unlock_attempts', 'unlocked_at']);
        });
    }
};
