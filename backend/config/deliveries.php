<?php

return [
    'origins' => [
        'port-of-dreams',
        'garden-of-ideas',
        'library-of-memories',
    ],
    'destinations' => [
        'port-of-dreams',
        'garden-of-ideas',
        'library-of-memories',
    ],
    'couriers' => [
        'paper-swallow',
        'postal-cat',
        'little-dragon',
    ],

    // One day is the maximum journey duration in this first MVP.
    'max_duration_minutes' => 24 * 60,

    // Retention is measured from the arrival instant, in UTC.
    'retention_days' => (int) env('DELIVERY_RETENTION_DAYS', 90),
    'retention_batch_size' => (int) env('DELIVERY_RETENTION_BATCH_SIZE', 100),
];
