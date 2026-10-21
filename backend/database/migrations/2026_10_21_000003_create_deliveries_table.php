<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('deliveries', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->text('message');
            $table->string('sender_name')->nullable();
            $table->string('recipient_name');
            $table->string('origin_code');
            $table->string('destination_code');
            $table->string('courier_code');
            $table->timestampTz('departure_at');
            $table->timestampTz('arrival_at');
            $table->string('access_token_hash', 64);
            $table->timestampsTz();

            $table->index('access_token_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
