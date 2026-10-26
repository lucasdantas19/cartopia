<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliveryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'public_id' => $this->public_id,
            'sender_name' => $this->sender_name,
            'recipient_name' => $this->recipient_name,
            'origin' => $this->origin,
            'destination' => $this->destination,
            'steps' => array_map(fn (array $step): array => [
                'title' => $step['title'],
                'description' => $step['description'] ?? null,
                'location' => $step['location'] ?? null,
                'starts_at' => is_string($step['starts_at']) ? $step['starts_at'] : $step['starts_at']->toISOString(),
                'arrives_at' => is_string($step['arrives_at']) ? $step['arrives_at'] : $step['arrives_at']->toISOString(),
            ], $this->routeSteps()),
            // Compatibilidade temporária com clientes que ainda conhecem apenas trechos.
            'route_legs' => $this->route_legs ?: [[
                'origin' => $this->origin,
                'destination' => $this->destination,
                'starts_at' => $this->starts_at?->toISOString(),
                'arrives_at' => $this->arrives_at?->toISOString(),
            ]],
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
