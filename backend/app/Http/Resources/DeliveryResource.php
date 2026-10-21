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
            'origin_code' => $this->origin_code,
            'destination_code' => $this->destination_code,
            'courier_code' => $this->courier_code,
            'departure_at' => $this->departure_at?->toISOString(),
            'arrival_at' => $this->arrival_at?->toISOString(),
            'state' => $this->state(),
            'progress' => $this->progress(),
        ];
    }
}
