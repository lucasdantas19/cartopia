<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateOptionalUser
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($token = $request->bearerToken()) {
            $user = User::where('api_token_hash', hash('sha256', $token))->first();
            if ($user) $request->setUserResolver(fn () => $user);
        }

        return $next($request);
    }
}
