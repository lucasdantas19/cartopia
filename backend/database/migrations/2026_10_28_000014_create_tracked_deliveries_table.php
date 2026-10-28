<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracked_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('delivery_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->text('access_token_encrypted');
            $table->string('label')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'delivery_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_deliveries');
    }
};
