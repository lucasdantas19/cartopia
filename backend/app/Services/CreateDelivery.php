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
        $durationMinutes = $attributes['duration_minutes'] ?? null;
        $finalDurationMinutes = $attributes['final_duration_minutes'] ?? null;
        $courier = $attributes['courier'] ?? config('deliveries.couriers.0');
        unset($attributes['duration_minutes']);
        unset($attributes['final_duration_minutes']);

        $hasNarrativeSteps = array_key_exists('steps', $attributes) || array_key_exists('legs', $attributes);
        $steps = $attributes['steps'] ?? null;
        $legs = $attributes['legs'] ?? null;
        if ($steps === null) {
            $steps = array_map(fn (array $leg): array => [
                'title' => 'A caminho de '.$leg['destination'],
                'description' => null,
                'location' => null,
                'duration_minutes' => $leg['duration_minutes'],
            ], $legs ?? [[
                'destination' => $attributes['destination'],
                'duration_minutes' => $durationMinutes,
            ]]);
        }
        unset($attributes['legs']);
        unset($attributes['steps']);

        $legStartsAt = $startsAt;

        $routeSteps = [];
        foreach ($steps as $step) {
            $stepArrivesAt = $legStartsAt->addMinutes($step['duration_minutes']);
            $routeSteps[] = [
                'title' => $step['title'],
                'description' => $step['description'] ?? null,
                'location' => $step['location'] ?? null,
                'starts_at' => $legStartsAt->toISOString(),
                'arrives_at' => $stepArrivesAt->toISOString(),
            ];
            $legStartsAt = $stepArrivesAt;
        }

        $routeLegs = [];
        if ($legs !== null) {
            $legacyOrigin = $attributes['origin'];
            $legacyStartsAt = $startsAt;
            foreach ($legs as $leg) {
                $legacyArrivesAt = $legacyStartsAt->addMinutes($leg['duration_minutes']);
                $routeLegs[] = [
                    'origin' => $legacyOrigin,
                    'destination' => $leg['destination'],
                    'starts_at' => $legacyStartsAt->toISOString(),
                    'arrives_at' => $legacyArrivesAt->toISOString(),
                ];
                $legacyOrigin = $leg['destination'];
                $legacyStartsAt = $legacyArrivesAt;
            }
        }

        $finalDurationMinutes ??= $hasNarrativeSteps ? 0 : $durationMinutes;
        $arrivesAt = $hasNarrativeSteps ? $legStartsAt->addMinutes($finalDurationMinutes) : $legStartsAt;

        $delivery = Delivery::create([
            ...$attributes,
            'courier' => $courier,
            'starts_at' => $startsAt,
            'arrives_at' => $arrivesAt,
            'final_duration_minutes' => $finalDurationMinutes,
            'route_steps' => $hasNarrativeSteps ? $routeSteps : [],
            'route_legs' => $routeLegs ?: null,
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
