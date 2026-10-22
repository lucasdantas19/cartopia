<?php

use App\Events\DeliveryMessageOpened;
use App\Models\Delivery;
use App\Services\OpenDeliveryMessage;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

it('allows the sender to see opening state but not the message', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload(['duration_minutes' => 1]));
    $data = $response->json('data');
    $senderToken = $response->json('sender_access_token');
    $recipientToken = $response->json('recipient_access_token');

    $this->withToken($senderToken)
        ->getJson('/api/deliveries/'.$data['public_id'])
        ->assertOk()
        ->assertJsonPath('data.access_role', 'sender')
        ->assertJsonPath('data.opened_at', null);

    $this->withToken($senderToken)
        ->getJson('/api/deliveries/'.$data['public_id'].'/message')
        ->assertNotFound();

    $this->withToken($recipientToken)
        ->getJson('/api/deliveries/'.$data['public_id'])
        ->assertJsonPath('data.access_role', 'recipient');
});

it('records only the first recipient opening and broadcasts it once', function () {
    Event::fake([DeliveryMessageOpened::class]);
    $now = CarbonImmutable::parse('2026-10-22 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    [$data, $recipientToken] = createDelivery(['duration_minutes' => 5]);
    CarbonImmutable::setTestNow($now->addMinutes(5));

    $first = $this->withToken($recipientToken)
        ->getJson('/api/deliveries/'.$data['public_id'].'/message')
        ->assertOk()
        ->json('data');
    $second = $this->withToken($recipientToken)
        ->getJson('/api/deliveries/'.$data['public_id'].'/message')
        ->assertOk()
        ->json('data');

    expect($first['opened_at'])->not->toBeNull()
        ->and($second['opened_at'])->toBe($first['opened_at'])
        ->and(Delivery::first()->opened_at->toISOString())->toBe($first['opened_at']);

    Event::assertDispatchedTimes(DeliveryMessageOpened::class, 1);
});

it('uses a conditional database update when opening concurrently', function () {
    Event::fake([DeliveryMessageOpened::class]);
    $delivery = Delivery::create([
        ...deliveryPayload(),
        'courier' => 'paper-swallow',
        'starts_at' => now()->subMinute(),
        'arrives_at' => now()->subSeconds(30),
        'access_token_hash' => hash('sha256', 'recipient-token'),
        'sender_access_token_hash' => hash('sha256', 'sender-token'),
    ]);

    $service = app(OpenDeliveryMessage::class);
    $service->handle($delivery);
    $service->handle($delivery->fresh());

    Event::assertDispatchedTimes(DeliveryMessageOpened::class, 1);
});

it('records one opening and one event across truly concurrent PostgreSQL connections', function () {
    config()->set('database.connections.concurrent', config('database.connections.pgsql'));
    $database = DB::connection('concurrent');
    $database->statement('CREATE TABLE test_delivery_open_events (id bigserial primary key, public_id uuid not null, opened_at timestamptz not null)');

    $now = CarbonImmutable::now('UTC');
    $delivery = Delivery::on('concurrent')->create([
        ...deliveryPayload(),
        'courier' => 'paper-swallow',
        'starts_at' => $now->subHour(),
        'arrives_at' => $now->subMinutes(30),
        'access_token_hash' => hash('sha256', 'recipient-token'),
        'sender_access_token_hash' => hash('sha256', 'sender-token'),
    ]);

    $startPipes = [];
    $processes = [];
    for ($index = 0; $index < 2; $index++) {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $processes[] = proc_open([
            PHP_BINARY,
            __DIR__.'/../Support/open_delivery.php',
            (string) $delivery->getKey(),
        ], $descriptors, $pipes, base_path());
        $startPipes[] = $pipes;
    }

    try {
        foreach ($startPipes as $pipes) {
            fwrite($pipes[0], "go\n");
            fclose($pipes[0]);
        }

        $exitCodes = array_map(function ($pipes, $process): int {
            stream_get_contents($pipes[1]);
            stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);

            return proc_close($process);
        }, $startPipes, $processes);

        expect($exitCodes)->toBe([0, 0])
            ->and(Delivery::on('concurrent')->findOrFail($delivery->getKey())->opened_at)->not->toBeNull()
            ->and($database->table('test_delivery_open_events')->count())->toBe(1);
    } finally {
        $database->table('deliveries')->where('id', $delivery->getKey())->delete();
        $database->statement('DROP TABLE test_delivery_open_events');
    }
});

it('keeps old deliveries compatible when no sender token exists', function () {
    $delivery = Delivery::create([
        ...deliveryPayload(),
        'courier' => 'paper-swallow',
        'starts_at' => now(),
        'arrives_at' => now()->addMinute(),
        'access_token_hash' => hash('sha256', 'legacy-token'),
    ]);

    $this->withToken('legacy-token')
        ->getJson('/api/deliveries/'.$delivery->public_id)
        ->assertOk()
        ->assertJsonPath('data.access_role', 'recipient');
});
