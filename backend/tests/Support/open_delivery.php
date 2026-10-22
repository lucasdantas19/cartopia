<?php

use App\Events\DeliveryMessageOpened;
use App\Models\Delivery;
use App\Services\OpenDeliveryMessage;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

fread(STDIN, 1);

Event::listen(DeliveryMessageOpened::class, function (DeliveryMessageOpened $event): void {
    DB::table('test_delivery_open_events')->insert([
        'public_id' => $event->publicId,
        'opened_at' => $event->openedAt,
    ]);
});

app(OpenDeliveryMessage::class)->handle(
    Delivery::findOrFail((int) ($argv[1] ?? 0))
);
