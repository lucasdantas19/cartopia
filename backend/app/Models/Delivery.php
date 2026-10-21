<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Delivery extends Model
{
    protected $fillable = [
        'public_id',
        'message',
        'sender_name',
        'recipient_name',
        'origin_code',
        'destination_code',
        'courier_code',
        'departure_at',
        'arrival_at',
        'access_token_hash',
    ];

    protected function casts(): array
    {
        return [
            'departure_at' => 'immutable_datetime',
            'arrival_at' => 'immutable_datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Delivery $delivery): void {
            $delivery->public_id ??= (string) Str::uuid();
        });
    }

    public function state(): string
    {
        $now = CarbonImmutable::now();

        if ($now->lt($this->departure_at)) {
            return 'SCHEDULED';
        }

        if ($now->gte($this->arrival_at)) {
            return 'DELIVERED';
        }

        return 'IN_TRANSIT';
    }

    public function progress(): int
    {
        $now = CarbonImmutable::now();

        if ($now->lte($this->departure_at)) {
            return 0;
        }

        if ($now->gte($this->arrival_at)) {
            return 100;
        }

        $duration = $this->departure_at->diffInSeconds($this->arrival_at);
        $elapsed = $this->departure_at->diffInSeconds($now);

        return max(0, min(100, (int) round(($elapsed / $duration) * 100)));
    }

    public function hasArrived(): bool
    {
        return $this->state() === 'DELIVERED';
    }
}
