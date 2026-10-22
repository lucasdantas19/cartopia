<?php

$defaultPublicHost = env('APP_ENV', 'production') === 'production' ? '' : 'localhost';
$defaultPublicPort = env('APP_ENV', 'production') === 'production' ? 443 : 8080;
$defaultPublicScheme = env('APP_ENV', 'production') === 'production' ? 'https' : 'http';

return [
    'default' => env('BROADCAST_CONNECTION', 'null'),

    'connections' => [
        'reverb' => [
            'driver' => 'reverb',
            'key' => env('REVERB_APP_KEY'),
            'secret' => env('REVERB_APP_SECRET'),
            'app_id' => env('REVERB_APP_ID'),
            'options' => [
                'host' => env('REVERB_HOST', $defaultPublicHost),
                'port' => env('REVERB_PORT', $defaultPublicPort),
                'scheme' => env('REVERB_SCHEME', $defaultPublicScheme),
                'useTLS' => env('REVERB_SCHEME', $defaultPublicScheme) === 'https',
            ],
        ],
        'log' => ['driver' => 'log'],
        'null' => ['driver' => 'null'],
    ],
];
