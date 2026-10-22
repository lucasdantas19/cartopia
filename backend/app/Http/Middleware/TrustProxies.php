<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as FrameworkTrustProxies;

class TrustProxies extends FrameworkTrustProxies
{
    protected function proxies()
    {
        return config('trustedproxy.proxies', []);
    }

    protected function headers()
    {
        return config('trustedproxy.headers');
    }
}
