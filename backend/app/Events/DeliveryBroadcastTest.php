<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class DeliveryBroadcastTest implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly string $publicId) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('deliveries.'.$this->publicId)];
    }

    public function broadcastAs(): string
    {
        return 'delivery.test';
    }

    public function broadcastWith(): array
    {
        return ['type' => 'test'];
    }
}
