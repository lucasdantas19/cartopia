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
            'courier' => $this->courier,
            'starts_at' => $this->starts_at?->toISOString(),
            'arrives_at' => $this->arrives_at?->toISOString(),
            'status' => $this->status(),
            'progress' => $this->progress(),
        ];
    }
}
