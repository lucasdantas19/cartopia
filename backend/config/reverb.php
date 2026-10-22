<?php

$defaultAllowedOrigins = env('APP_ENV', 'production') === 'production'
    ? ''
    : 'http://localhost:5173,http://127.0.0.1:5173';
$defaultPublicHost = env('APP_ENV', 'production') === 'production' ? '' : 'localhost';
$defaultPublicPort = env('APP_ENV', 'production') === 'production' ? 443 : 8080;
$defaultPublicScheme = env('APP_ENV', 'production') === 'production' ? 'https' : 'http';

return [
    'default' => env('REVERB_SERVER', 'reverb'),

    'servers' => [
        'reverb' => [
            'host' => env('REVERB_SERVER_HOST', env('APP_ENV', 'production') === 'production' ? '127.0.0.1' : '0.0.0.0'),
            'port' => env('REVERB_SERVER_PORT', 8080),
            'path' => env('REVERB_SERVER_PATH', ''),
            'hostname' => env('REVERB_HOST', $defaultPublicHost),
            'options' => ['tls' => []],
            'max_request_size' => env('REVERB_MAX_REQUEST_SIZE', 10_000),
            'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 15),
            'telescope_ingest_interval' => env('REVERB_TELESCOPE_INGEST_INTERVAL', 15),
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
                'channel' => env('REVERB_SCALING_CHANNEL', 'reverb'),
                'server' => [
                    'url' => env('REDIS_URL'),
                    'host' => env('REDIS_HOST', '127.0.0.1'),
                    'port' => env('REDIS_PORT', '6379'),
                    'username' => env('REDIS_USERNAME'),
                    'password' => env('REDIS_PASSWORD'),
                    'database' => env('REDIS_DB', '0'),
                    'timeout' => env('REDIS_TIMEOUT', 60),
                ],
            ],
        ],
    ],

    'apps' => [
        'provider' => 'config',
        'apps' => [[
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            'ping_interval' => env('REVERB_APP_PING_INTERVAL', 60),
            'activity_timeout' => env('REVERB_APP_ACTIVITY_TIMEOUT', 30),
            'options' => [
                'host' => env('REVERB_HOST', $defaultPublicHost),
                'port' => env('REVERB_PORT', $defaultPublicPort),
                'scheme' => env('REVERB_SCHEME', $defaultPublicScheme),
                'useTLS' => env('REVERB_SCHEME', $defaultPublicScheme) === 'https',
            ],
            'allowed_origins' => array_filter(array_map('trim', explode(',', env('REVERB_ALLOWED_ORIGINS', $defaultAllowedOrigins)))),
            'max_connections' => env('REVERB_APP_MAX_CONNECTIONS'),
            'max_message_size' => env('REVERB_APP_MAX_MESSAGE_SIZE', 10_000),
            'accept_client_events_from' => env('REVERB_APP_ACCEPT_CLIENT_EVENTS_FROM', 'none'),
            'rate_limiting' => [
                'enabled' => env('REVERB_APP_RATE_LIMITING_ENABLED', false),
                'max_attempts' => env('REVERB_APP_RATE_LIMIT_MAX_ATTEMPTS', 60),
                'decay_seconds' => env('REVERB_APP_RATE_LIMIT_DECAY_SECONDS', 60),
                'terminate_on_limit' => env('REVERB_APP_RATE_LIMIT_TERMINATE', false),
            ],
        ]],
    ],
];
