<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('delivery-creation', fn (Request $request) =>
            Limit::perMinute((int) config('rate_limits.delivery_creation', 5))
                ->by('ip:'.($request->ip() ?? 'unknown'))
        );

        RateLimiter::for('delivery-tracking', fn (Request $request) =>
            Limit::perMinute((int) config('rate_limits.delivery_tracking', 60))
                ->by('ip:'.($request->ip() ?? 'unknown'))
        );

        RateLimiter::for('message-opening', fn (Request $request) =>
            Limit::perMinute((int) config('rate_limits.message_opening', 20))
                ->by('ip:'.($request->ip() ?? 'unknown'))
        );

        RateLimiter::for('broadcasting-auth', fn (Request $request) =>
            Limit::perMinute((int) config('rate_limits.broadcasting_auth', 30))
                ->by('ip:'.($request->ip() ?? 'unknown'))
        );

        Broadcast::channel('deliveries.{publicId}', fn (): bool => true);
        Broadcast::channel('deliveries.{publicId}.sender', fn (): bool => true);
    }
}
