<?php

use App\Events\DeliveryBroadcastTest;
use App\Events\DeliveryMessageOpened;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Event;

function configureBroadcastingForTest(): void
{
    config()->set('broadcasting.default', 'reverb');
    config()->set('broadcasting.connections.reverb.key', 'test-key');
    config()->set('broadcasting.connections.reverb.secret', 'test-secret');
    config()->set('broadcasting.connections.reverb.app_id', 'test-app');
    Broadcast::channel('deliveries.{publicId}', fn (): bool => true);
    Broadcast::channel('deliveries.{publicId}.sender', fn (): bool => true);
}

it('authorizes a delivery private channel with its bearer token', function () {
    configureBroadcastingForTest();
    [$data, $token] = createDelivery();

    $response = $this->withToken($token)->postJson('/api/broadcasting/auth', [
        'channel_name' => 'private-deliveries.'.$data['public_id'],
        'socket_id' => '1234.5678',
    ]);
    $response->assertOk()->assertJsonStructure(['auth']);
});

it('rejects missing, invalid, and cross-delivery broadcast tokens', function () {
    configureBroadcastingForTest();
    [$first, $firstToken] = createDelivery();
    [$second] = createDelivery();

    $payload = ['channel_name' => 'private-deliveries.'.$first['public_id'], 'socket_id' => '1234.5678'];

    $this->postJson('/api/broadcasting/auth', $payload)->assertForbidden();
    $this->withToken('invalid-token')->postJson('/api/broadcasting/auth', $payload)->assertForbidden();
    $this->withToken($firstToken)->postJson('/api/broadcasting/auth', [
        ...$payload,
        'channel_name' => 'private-deliveries.'.$second['public_id'],
    ])->assertForbidden();
});

it('protects the sender channel with only the sender token', function () {
    configureBroadcastingForTest();
    $response = $this->postJson('/api/deliveries', deliveryPayload());
    $data = $response->json('data');
    $senderToken = $response->json('sender_access_token');
    $recipientToken = $response->json('recipient_access_token');
    $payload = ['channel_name' => 'private-deliveries.'.$data['public_id'].'.sender', 'socket_id' => '1234.5678'];

    $this->withToken($recipientToken)->postJson('/api/broadcasting/auth', $payload)->assertForbidden();
    $this->withToken($senderToken)->postJson('/api/broadcasting/auth', $payload)->assertOk();
});

it('keeps the test event free of delivery data', function () {
    $event = new DeliveryBroadcastTest('public-id');

    expect($event->broadcastWith())->toBe(['type' => 'test'])
        ->and($event->broadcastAs())->toBe('delivery.test');
});

it('broadcasts only opening metadata', function () {
    $event = new DeliveryMessageOpened('public-id', '2026-10-22T12:00:00.000000Z');

    expect((string) $event->broadcastOn()[0])->toBe('private-deliveries.public-id.sender')
        ->and($event->broadcastWith())->toBe([
            'public_id' => 'public-id',
            'opened_at' => '2026-10-22T12:00:00.000000Z',
        ]);
});

it('dispatches the development broadcast test command', function () {
    Event::fake([DeliveryBroadcastTest::class]);
    [$data] = createDelivery();

    $this->artisan('cartopia:broadcast-test', ['publicId' => $data['public_id']])
        ->assertSuccessful();

    Event::assertDispatched(DeliveryBroadcastTest::class, fn (DeliveryBroadcastTest $event) => $event->publicId === $data['public_id']);
});
