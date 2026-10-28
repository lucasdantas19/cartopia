<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('deliveries', function (Blueprint $table): void {
            $table->string('recipient_email')->nullable()->after('recipient_name');
            $table->text('recipient_access_token_encrypted')->nullable()->after('access_token_hash');
            $table->index('recipient_email');
        });

        Schema::table('saved_recipients', function (Blueprint $table): void {
            $table->string('email')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('saved_recipients', function (Blueprint $table): void {
            $table->dropColumn('email');
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex(['recipient_email']);
            $table->dropColumn(['recipient_email', 'recipient_access_token_encrypted']);
        });
    }
};
