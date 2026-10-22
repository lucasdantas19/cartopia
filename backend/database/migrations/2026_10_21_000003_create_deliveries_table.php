<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
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
            $table->string('origin');
            $table->string('destination');
            $table->string('courier');
            $table->timestampTz('starts_at');
            $table->timestampTz('arrives_at');
            $table->string('access_token_hash', 64);
            $table->timestampsTz();

            $table->index('access_token_hash');
        });

        if (Schema::getConnection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE deliveries ADD CONSTRAINT deliveries_origin_destination_different CHECK (origin <> destination)');
            DB::statement('ALTER TABLE deliveries ADD CONSTRAINT deliveries_arrival_after_start CHECK (arrives_at >= starts_at)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('deliveries');
    }
};
