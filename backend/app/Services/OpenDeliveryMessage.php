<?php

namespace App\Services;

use App\Events\DeliveryMessageOpened;
use App\Models\Delivery;
use Illuminate\Support\Facades\DB;
use Throwable;

class OpenDeliveryMessage
{
    public function handle(Delivery $delivery): Delivery
    {
        $openedAt = now('UTC');
        $recorded = DB::transaction(function () use ($delivery, $openedAt): bool {
            return Delivery::whereKey($delivery->getKey())
                ->whereNull('opened_at')
                ->update([
                    'opened_at' => $openedAt,
                    'updated_at' => $openedAt,
                ]) === 1;
        });

        $delivery->refresh();

        if ($recorded) {
            try {
                DeliveryMessageOpened::dispatch($delivery->public_id, $delivery->opened_at->toISOString());
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        return $delivery;
    }
}
