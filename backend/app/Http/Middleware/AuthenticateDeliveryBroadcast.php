<?php

namespace App\Http\Middleware;

use App\Models\Delivery;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateDeliveryBroadcast
{
    public function handle(Request $request, Closure $next): Response
    {
        $channelName = (string) $request->input('channel_name', '');

        if (! preg_match('/^private-deliveries\.([0-9a-f-]{36})(\.sender)?$/i', $channelName, $matches)) {
            abort(403);
        }

        $delivery = Delivery::where('public_id', $matches[1])->first();
        $token = $request->bearerToken();
        $isSenderChannel = isset($matches[2]) && $matches[2] === '.sender';
        $tokenHash = $token === null ? null : hash('sha256', $token);
        $expectedHash = $isSenderChannel ? $delivery?->sender_access_token_hash : $delivery?->access_token_hash;

        if ($delivery === null || $tokenHash === null || $expectedHash === null || ! hash_equals($expectedHash, $tokenHash)) {
            abort(403);
        }

        $request->setUserResolver(fn () => (object) ['delivery_public_id' => $delivery->public_id]);

        return $next($request);
    }
}
