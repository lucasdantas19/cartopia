<?php

namespace App\Services;

use App\Models\Delivery;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class CreateDelivery
{
    /**
     * @return array{delivery: Delivery, recipient_access_token: string, sender_access_token: string}
     */
    public function handle(array $attributes, ?int $userId = null): array
    {
        $destination = app(ResolveRecipientDestination::class)->handle($attributes, $userId);
        $attributes = [...$attributes, ...$destination];
        $startsAt = CarbonImmutable::now('UTC');
        $recipientAccessToken = bin2hex(random_bytes(32));
        $senderAccessToken = bin2hex(random_bytes(32));
        $durationMinutes = $attributes['duration_minutes'] ?? null;
        $requestedArrivalAt = isset($attributes['arrival_at'])
            ? CarbonImmutable::parse($attributes['arrival_at'])->utc()
            : null;
        $finalDurationMinutes = $attributes['final_duration_minutes'] ?? null;
        $courier = $attributes['courier'] ?? config('deliveries.couriers.0');
        $routeVisibility = $attributes['route_visibility'] ?? 'full';
        $unlockType = $attributes['unlock_type'] ?? 'none';
        $unlockPassword = $attributes['unlock_password'] ?? null;
        unset($attributes['arrival_at']);
        unset($attributes['duration_minutes']);
        unset($attributes['final_duration_minutes']);
        unset($attributes['route_visibility']);
        unset($attributes['unlock_password']);

        if (isset($attributes['origin_location'])) {
            $attributes['origin'] = $attributes['origin_location']['label'];
        }
        if (isset($attributes['destination_location'])) {
            $attributes['destination'] = $attributes['destination_location']['label'];
        }

        $hasNarrativeSteps = ! empty($attributes['steps'] ?? null) || ! empty($attributes['legs'] ?? null);
        $steps = $attributes['steps'] ?? null;
        $legs = $attributes['legs'] ?? null;
        if ($steps === null && $hasNarrativeSteps) {
            $steps = array_map(fn (array $leg): array => [
                'title' => 'A caminho de '.$leg['destination'],
                'description' => null,
                'location' => null,
                'duration_minutes' => $leg['duration_minutes'],
            ], $legs);
        }
        $steps ??= [];
        unset($attributes['legs']);
        unset($attributes['steps']);

        $legStartsAt = $startsAt;

        $routeSteps = [];
        foreach ($steps as $step) {
            $stepArrivesAt = isset($step['arrival_at'])
                ? CarbonImmutable::parse($step['arrival_at'])->utc()
                : $legStartsAt->addMinutes($step['duration_minutes']);
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

        $finalDurationMinutes = $hasNarrativeSteps
            ? ($requestedArrivalAt
                ? max(1, (int) ceil($legStartsAt->diffInSeconds($requestedArrivalAt) / 60))
                : ($finalDurationMinutes ?? 0))
            : ($requestedArrivalAt ? max(1, (int) ceil($startsAt->diffInSeconds($requestedArrivalAt) / 60)) : $durationMinutes);
        $arrivesAt = $hasNarrativeSteps
            ? ($requestedArrivalAt ?? $legStartsAt->addMinutes($finalDurationMinutes))
            : ($requestedArrivalAt ?? $startsAt->addMinutes($durationMinutes));

        $delivery = Delivery::create([
            ...$attributes,
            'user_id' => $userId,
            'courier' => $courier,
            'starts_at' => $startsAt,
            'arrives_at' => $arrivesAt,
            'final_duration_minutes' => $finalDurationMinutes,
            'unlock_type' => $unlockType,
            'unlock_answer_hash' => $unlockType === 'password' ? Hash::make($unlockPassword) : null,
            'unlock_answer_encrypted' => $unlockType === 'hangman' ? Crypt::encryptString($this->normalizeHangmanAnswer((string) $unlockPassword)) : null,
            'unlock_state' => $unlockType === 'hangman' ? ['guessed_letters' => []] : null,
            'unlock_attempts' => 0,
            'unlocked_at' => $unlockType === 'none' ? $startsAt : null,
            'route_steps' => $hasNarrativeSteps ? $routeSteps : [],
            'route_visibility' => $routeVisibility,
            'route_legs' => $routeLegs ?: null,
            'access_token_hash' => hash('sha256', $recipientAccessToken),
            'recipient_access_token_encrypted' => Crypt::encryptString($recipientAccessToken),
            'sender_access_token_hash' => hash('sha256', $senderAccessToken),
            'sender_access_token_encrypted' => Crypt::encryptString($senderAccessToken),
        ]);

        return [
            'delivery' => $delivery,
            'recipient_access_token' => $recipientAccessToken,
            'sender_access_token' => $senderAccessToken,
        ];
    }

    private function normalizeHangmanAnswer(string $answer): string
    {
        $answer = mb_strtoupper(transliterator_transliterate('Any-Latin; Latin-ASCII', trim($answer)));
        return preg_replace('/[^A-Z ]/', '', $answer) ?: '';
    }
}
