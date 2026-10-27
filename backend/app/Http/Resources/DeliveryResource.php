<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Carbon\CarbonImmutable;

class DeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $allSteps = $this->routeSteps();
        $hiddenStepsCount = 0;
        $steps = $allSteps;
        if (($this->access_role ?? null) === 'recipient' && $this->route_visibility === 'progressive') {
            $now = CarbonImmutable::now('UTC');
            $steps = array_values(array_filter($allSteps, function (array $step) use ($now): bool {
                $startsAt = $step['starts_at'] instanceof CarbonImmutable ? $step['starts_at'] : CarbonImmutable::parse($step['starts_at']);
                return $now->gte($startsAt);
            }));
            $hiddenStepsCount = count($allSteps) - count($steps);
        }
        $routeLegs = $this->route_legs ?: [[
            'origin' => $this->origin,
            'destination' => $this->destination,
            'starts_at' => $this->starts_at?->toISOString(),
            'arrives_at' => $this->arrives_at?->toISOString(),
        ]];
        if (($this->access_role ?? null) === 'recipient' && $this->route_visibility === 'progressive') {
            $routeLegs = [[
                'origin' => $this->origin,
                'destination' => $this->destination,
                'starts_at' => $this->starts_at?->toISOString(),
                'arrives_at' => $this->arrives_at?->toISOString(),
            ]];
        }

        return [
            'public_id' => $this->public_id,
            'sender_name' => $this->sender_name,
            'recipient_name' => $this->recipient_name,
            'origin' => $this->origin,
            'origin_location' => $this->origin_location,
            'destination' => $this->destination,
            'destination_location' => $this->destination_location,
            'steps' => array_map(fn (array $step): array => [
                'title' => $step['title'],
                'description' => $step['description'] ?? null,
                'location' => $step['location'] ?? null,
                'starts_at' => is_string($step['starts_at']) ? $step['starts_at'] : $step['starts_at']->toISOString(),
                'arrives_at' => is_string($step['arrives_at']) ? $step['arrives_at'] : $step['arrives_at']->toISOString(),
            ], $steps),
            'route_visibility' => $this->route_visibility,
            'hidden_steps_count' => $hiddenStepsCount,
            // Compatibilidade temporária com clientes que ainda conhecem apenas trechos.
            'route_legs' => $routeLegs,
            'current_step' => $this->currentStepIndex(),
            'courier' => $this->courier,
            'starts_at' => $this->starts_at?->toISOString(),
            'arrives_at' => $this->arrives_at?->toISOString(),
            'final_duration_minutes' => $this->final_duration_minutes,
            'status' => $this->status(),
            'progress' => $this->progress(),
            'opened_at' => $this->opened_at?->toISOString(),
            'access_role' => $this->access_role ?? null,
        ];
    }
}
