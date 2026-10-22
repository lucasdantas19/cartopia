<?php

namespace App\Services;

use App\Models\Delivery;
use Carbon\CarbonImmutable;

class CreateDelivery
{
    /**
     * @return array{delivery: Delivery, recipient_access_token: string, sender_access_token: string}
     */
    public function handle(array $attributes): array
    {
        $startsAt = CarbonImmutable::now('UTC');
        $recipientAccessToken = bin2hex(random_bytes(32));
        $senderAccessToken = bin2hex(random_bytes(32));
        $durationMinutes = $attributes['duration_minutes'];
        unset($attributes['duration_minutes']);

        $delivery = Delivery::create([
            ...$attributes,
            'courier' => config('deliveries.couriers.0'),
            'starts_at' => $startsAt,
            'arrives_at' => $startsAt->addMinutes($durationMinutes),
            'access_token_hash' => hash('sha256', $recipientAccessToken),
            'sender_access_token_hash' => hash('sha256', $senderAccessToken),
        ]);

        return [
            'delivery' => $delivery,
            'recipient_access_token' => $recipientAccessToken,
            'sender_access_token' => $senderAccessToken,
        ];
    }
}
