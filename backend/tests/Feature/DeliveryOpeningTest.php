<?php

use App\Events\DeliveryMessageOpened;
use App\Models\Delivery;
use App\Services\OpenDeliveryMessage;
use Carbon\CarbonImmutable;
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
