<?php

return [
    'delivery_creation' => (int) env('DELIVERY_CREATION_RATE_LIMIT', 5),
    'delivery_tracking' => (int) env('DELIVERY_TRACKING_RATE_LIMIT', 60),
    'message_opening' => (int) env('MESSAGE_OPENING_RATE_LIMIT', 20),
    'broadcasting_auth' => (int) env('BROADCASTING_AUTH_RATE_LIMIT', 30),
];
