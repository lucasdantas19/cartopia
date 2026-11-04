<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('allow_contact_delivery')->default(false)->after('email');
        });

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->foreignId('recipient_user_id')->nullable()->after('recipient_email')->constrained('users')->nullOnDelete();
            $table->text('sender_access_token_encrypted')->nullable()->after('sender_access_token_hash');
            $table->string('destination_source')->default('specific')->after('destination_location');
            $table->index(['recipient_user_id', 'created_at']);
        });

        Schema::create('delivery_preferences', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipient_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('saved_location_id')->constrained('saved_locations')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['recipient_user_id', 'sender_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_preferences');

        Schema::table('deliveries', function (Blueprint $table): void {
            $table->dropIndex(['recipient_user_id', 'created_at']);
            $table->dropForeign(['recipient_user_id']);
            $table->dropColumn(['recipient_user_id', 'sender_access_token_encrypted', 'destination_source']);
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('allow_contact_delivery');
        });
    }
};
