<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('deliveries')
            ->whereNull('route_steps')
            ->orderBy('id')
            ->chunkById(100, function ($deliveries): void {
                foreach ($deliveries as $delivery) {
                    $legs = is_string($delivery->route_legs)
                        ? json_decode($delivery->route_legs, true)
                        : $delivery->route_legs;

                    $steps = is_array($legs) ? array_map(fn (array $leg): array => [
                        'title' => 'A caminho de '.$leg['destination'],
                        'description' => null,
                        'location' => null,
                        'starts_at' => $leg['starts_at'],
                        'arrives_at' => $leg['arrives_at'],
                    ], $legs) : [];

                    DB::table('deliveries')
                        ->where('id', $delivery->id)
                        ->update(['route_steps' => json_encode($steps, JSON_THROW_ON_ERROR)]);
                }
            });
    }

    public function down(): void
    {
        // Backfill irreversível: não removemos dados narrativos em um rollback.
    }
};
