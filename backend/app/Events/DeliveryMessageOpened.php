<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryMessageOpened implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $publicId,
        public readonly string $openedAt,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('deliveries.'.$this->publicId.'.sender')];
    }

    public function broadcastAs(): string
    {
        return 'delivery.message-opened';
    }

    public function broadcastWith(): array
    {
        return [
            'public_id' => $this->publicId,
            'opened_at' => $this->openedAt,
        ];
    }
}
