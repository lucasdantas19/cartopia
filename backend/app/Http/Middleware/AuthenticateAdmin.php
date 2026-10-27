<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $configuredToken = (string) config('deliveries.admin_token');
        $providedToken = (string) $request->bearerToken();

        if ($configuredToken === '' || $providedToken === '' || ! hash_equals($configuredToken, $providedToken)) {
            return response()->json(['error' => ['code' => 'ADMIN_UNAUTHORIZED', 'message' => 'Acesso administrativo não autorizado.']], 401);
        }

        return $next($request);
    }
}
