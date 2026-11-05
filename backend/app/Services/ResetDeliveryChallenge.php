<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Support\Facades\DB;

class ResetDeliveryChallenge
{
    public function handle(Delivery $delivery): bool
    {
        if ($delivery->unlock_type === 'none'
            || $delivery->opened_at !== null
            || $delivery->unlock_attempts < (int) config('deliveries.max_unlock_attempts')) {
            return false;
        }

        $updates = [
            'unlock_attempts' => 0,
            'unlocked_at' => null,
            'updated_at' => now('UTC'),
        ];
        if ($delivery->unlock_type === 'hangman') {
            $updates['unlock_state'] = json_encode(['guessed_letters' => []]);
        }

        DB::table('deliveries')->where('id', $delivery->id)->update($updates);

        return true;
    }
}
