<?php

use App\Models\Delivery;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

function deliveryPayload(array $overrides = []): array
{
    return array_merge([
        'message' => 'Uma surpresa chegou até você.',
        'sender_name' => 'Aventureiro',
        'recipient_name' => 'Pessoa querida',
        'origin' => 'port-of-dreams',
        'destination' => 'garden-of-ideas',
        'duration_minutes' => 60,
    ], $overrides);
}

function createDelivery(array $overrides = []): array
{
    $response = test()->postJson('/api/deliveries', deliveryPayload($overrides));

    $response->assertCreated();

    return [
        $response->json('data'),
        $response->json('access_token'),
    ];
}

afterEach(function () {
    CarbonImmutable::setTestNow();
});

it('creates a delivery with a public UUID and a secure access token', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload());
    $response->assertCreated();
    $data = $response->json('data');
    $token = $response->json('recipient_access_token');
    $senderToken = $response->json('sender_access_token');

    expect($data['public_id'])->toMatch('/^[0-9a-f-]{36}$/')
        ->and($token)->toMatch('/^[0-9a-f]{64}$/')
        ->and($senderToken)->toMatch('/^[0-9a-f]{64}$/')
        ->and($senderToken)->not->toBe($token)
        ->and($data['courier'])->toBe('paper-swallow')
        ->and($data)->not->toHaveKey('message');

    expect($response->json('recipient_tracking_path'))->toContain($token)
        ->and($response->json('recipient_tracking_path'))->not->toContain($senderToken)
        ->and($response->json('sender_tracking_path'))->toContain($senderToken)
        ->and($response->json('sender_tracking_path'))->not->toContain($token);

    expect(Delivery::first()->access_token_hash)
        ->toBe(hash('sha256', $token))
        ->not->toBe($token)
        ->and(Delivery::first()->sender_access_token_hash)
        ->toBe(hash('sha256', $senderToken))
        ->not->toBe($senderToken);
});

it('creates deliveries with each supported courier', function (string $courier) {
    $response = $this->postJson('/api/deliveries', deliveryPayload(['courier' => $courier]));

    $response->assertCreated()->assertJsonPath('data.courier', $courier);
    expect(Delivery::first()->courier)->toBe($courier);

    $this->withToken($response->json('recipient_access_token'))
        ->getJson('/api/deliveries/'.$response->json('data.public_id'))
        ->assertOk()
        ->assertJsonPath('data.courier', $courier);
})->with(['paper-swallow', 'postal-cat', 'little-dragon']);

it('rejects an unsupported courier', function () {
    $this->postJson('/api/deliveries', deliveryPayload(['courier' => 'unknown-courier']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('courier');
});

it('keeps a five-minute delivery five minutes apart in UTC', function () {
    $now = CarbonImmutable::parse('2026-10-21 15:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);

    [$data] = createDelivery(['duration_minutes' => 5]);

    expect($data['starts_at'])->toBe('2026-10-21T15:00:00.000000Z')
        ->and($data['arrives_at'])->toBe('2026-10-21T15:05:00.000000Z')
        ->and(Delivery::first()->starts_at->diffInSeconds(Delivery::first()->arrives_at))->toEqual(300);
});

it('serializes delivery instants with an explicit UTC timezone', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:00:00', 'UTC'));
    [$data, $token] = createDelivery(['duration_minutes' => 5]);

    $this->withToken($token)
        ->getJson('/api/deliveries/'.$data['public_id'])
        ->assertOk()
        ->assertJsonPath('data.starts_at', '2026-10-21T15:00:00.000000Z')
        ->assertJsonPath('data.arrives_at', '2026-10-21T15:05:00.000000Z');
});

it('requires the delivery fields', function () {
    $this->postJson('/api/deliveries', [])->assertUnprocessable()
        ->assertJsonValidationErrors([
            'message',
            'recipient_name',
            'origin',
            'destination',
            'duration_minutes',
        ]);
});

it('rejects equal locations', function () {
    $this->postJson('/api/deliveries', deliveryPayload([
        'destination' => 'port-of-dreams',
    ]))->assertUnprocessable()->assertJsonValidationErrors('destination');
});

it('rejects non-positive and excessive durations', function (int $duration) {
    $this->postJson('/api/deliveries', deliveryPayload([
        'duration_minutes' => $duration,
    ]))->assertUnprocessable()->assertJsonValidationErrors('duration_minutes');
})->with([0, 24 * 60 + 1]);

it('hides a delivery when the access token is missing or invalid', function () {
    [$data, $token] = createDelivery();

    $this->getJson('/api/deliveries/'.$data['public_id'])->assertNotFound();
    $this->withToken('invalid-token')->getJson('/api/deliveries/'.$data['public_id'])->assertNotFound();
    $this->getJson('/api/deliveries/'.$data['public_id'].'/message')->assertNotFound();
    $this->withToken('invalid-token')->getJson('/api/deliveries/'.$data['public_id'].'/message')->assertNotFound();
    $this->withToken($token)->getJson('/api/deliveries/00000000-0000-0000-0000-000000000000')->assertNotFound();
});

it('returns tracking data without exposing the message', function () {
    [$data, $token] = createDelivery();

    $this->withToken($token)
        ->getJson('/api/deliveries/'.$data['public_id'])
        ->assertOk()
        ->assertJsonPath('data.public_id', $data['public_id'])
        ->assertJsonMissing(['message' => 'Uma surpresa chegou até você.']);
});

it('blocks the message until the delivery arrives', function () {
    [$data, $token] = createDelivery(['duration_minutes' => 10]);

    $this->withToken($token)
        ->getJson('/api/deliveries/'.$data['public_id'].'/message')
        ->assertForbidden()
        ->assertJsonPath('error.code', 'DELIVERY_NOT_ARRIVED');
});

it('reveals the message after arrival', function () {
    $now = CarbonImmutable::parse('2026-10-21 12:00:00');
    CarbonImmutable::setTestNow($now);
    [$data, $token] = createDelivery(['duration_minutes' => 10]);

    CarbonImmutable::setTestNow($now->addMinutes(10));

    $this->withToken($token)
        ->getJson('/api/deliveries/'.$data['public_id'].'/message')
        ->assertOk()
        ->assertJsonPath('data.message', 'Uma surpresa chegou até você.')
        ->assertJsonPath('data.delivered_at', '2026-10-21T12:10:00.000000Z');
});

it('calculates progress and state from time', function () {
    $now = CarbonImmutable::parse('2026-10-21 12:00:00');
    CarbonImmutable::setTestNow($now);
    [$data, $token] = createDelivery(['duration_minutes' => 100]);

    $this->withToken($token)->getJson('/api/deliveries/'.$data['public_id'])
        ->assertJsonPath('data.status', 'IN_TRANSIT')
        ->assertJsonPath('data.progress', 0);

    CarbonImmutable::setTestNow($now->addMinutes(50));
    $this->withToken($token)->getJson('/api/deliveries/'.$data['public_id'])
        ->assertJsonPath('data.status', 'IN_TRANSIT')
        ->assertJsonPath('data.progress', 50);

    CarbonImmutable::setTestNow($now->addMinutes(100));
    $this->withToken($token)->getJson('/api/deliveries/'.$data['public_id'])
        ->assertJsonPath('data.status', 'DELIVERED')
        ->assertJsonPath('data.progress', 100);
});

it('reports scheduled state before departure', function () {
    $now = CarbonImmutable::parse('2026-10-21 12:00:00');
    CarbonImmutable::setTestNow($now);

    $delivery = Delivery::create([
        ...deliveryPayload(),
        'public_id' => (string) Str::uuid(),
        'courier' => 'paper-swallow',
        'starts_at' => $now->addHour(),
        'arrives_at' => $now->addHours(2),
        'access_token_hash' => hash('sha256', 'test-token'),
    ]);

    expect($delivery->status())->toBe('SCHEDULED')
        ->and($delivery->progress())->toBe(0);
});
