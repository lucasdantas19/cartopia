<?php

namespace App\Services;

use App\Models\Delivery;
use Illuminate\Http\Request;

class AuthorizeDelivery
{
    /**
     * @return array{delivery: Delivery, role: 'sender'|'recipient'}
     */
    public function handle(Request $request, string $publicId, ?string $requiredRole = null): array
    {
        $delivery = Delivery::where('public_id', $publicId)->first();
        $token = $request->bearerToken();

        if ($delivery === null || $token === null) {
            abort(404);
        }

        $hash = hash('sha256', $token);
        $role = hash_equals($delivery->access_token_hash, $hash)
            ? 'recipient'
            : ($delivery->sender_access_token_hash !== null && hash_equals($delivery->sender_access_token_hash, $hash) ? 'sender' : null);

        if ($role === null || ($requiredRole !== null && $role !== $requiredRole)) {
            abort(404);
        }

        return ['delivery' => $delivery, 'role' => $role];
    }
}
