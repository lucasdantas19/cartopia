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
        'origin',
        'destination',
        'courier',
        'starts_at',
        'arrives_at',
        'access_token_hash',
        'sender_access_token_hash',
        'opened_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'immutable_datetime:UTC',
            'arrives_at' => 'immutable_datetime:UTC',
            'opened_at' => 'immutable_datetime:UTC',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Delivery $delivery): void {
            $delivery->public_id ??= (string) Str::uuid();
        });
    }

    public function status(): string
    {
        $now = CarbonImmutable::now('UTC');

        if ($now->lt($this->starts_at)) {
            return 'SCHEDULED';
        }

        if ($now->gte($this->arrives_at)) {
            return 'DELIVERED';
        }

        return 'IN_TRANSIT';
    }

    public function progress(): int
    {
        $now = CarbonImmutable::now('UTC');

        if ($now->lte($this->starts_at)) {
            return 0;
        }

        if ($now->gte($this->arrives_at)) {
            return 100;
        }

        $duration = $this->starts_at->diffInSeconds($this->arrives_at);
        $elapsed = $this->starts_at->diffInSeconds($now);

        return max(0, min(100, (int) round(($elapsed / $duration) * 100)));
    }

    public function hasArrived(): bool
    {
        return $this->status() === 'DELIVERED';
    }
}
