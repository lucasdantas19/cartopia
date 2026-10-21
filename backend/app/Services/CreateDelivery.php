<?php

namespace App\Services;

use App\Models\Delivery;
use Carbon\CarbonImmutable;

class CreateDelivery
{
    /**
     * @return array{delivery: Delivery, access_token: string}
     */
    public function handle(array $attributes): array
    {
        $departureAt = CarbonImmutable::now();
        $accessToken = bin2hex(random_bytes(32));
        $durationMinutes = $attributes['duration_minutes'];
        unset($attributes['duration_minutes']);

        $delivery = Delivery::create([
            ...$attributes,
            'courier_code' => config('deliveries.couriers.0'),
            'departure_at' => $departureAt,
            'arrival_at' => $departureAt->addMinutes($durationMinutes),
            'access_token_hash' => hash('sha256', $accessToken),
        ]);

        return ['delivery' => $delivery, 'access_token' => $accessToken];
    }
}
