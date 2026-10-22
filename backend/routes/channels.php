<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('deliveries.{publicId}', function (): bool {
    return true;
});

Broadcast::channel('deliveries.{publicId}.sender', function (): bool {
    return true;
});
