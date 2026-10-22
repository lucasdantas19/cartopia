<?php

use App\Events\DeliveryBroadcastTest;
use App\Models\Delivery;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('cartopia:broadcast-test {publicId}', function (string $publicId) {
    if (! Delivery::where('public_id', $publicId)->exists()) {
        $this->error('Entrega não encontrada.');

        return self::FAILURE;
    }

    DeliveryBroadcastTest::dispatch($publicId);
    $this->info('Evento de teste enviado para a entrega.');

    return self::SUCCESS;
})->purpose('Dispara o evento de teste do broadcasting em desenvolvimento');
