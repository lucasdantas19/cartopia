<?php

use App\Models\Delivery;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

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
        ->and($data['steps'])->toBe([])
        ->and($data['final_duration_minutes'])->toBe(60)
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

it('creates a direct delivery when the steps array is empty', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:00:00', 'UTC'));

    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'steps' => [],
        'final_duration_minutes' => 30,
    ]));

    $response->assertCreated()
        ->assertJsonCount(0, 'data.steps')
        ->assertJsonPath('data.final_duration_minutes', 60)
        ->assertJsonPath('data.arrives_at', '2026-10-21T16:00:00.000000Z');
});

it('creates an adventure with sequential route legs', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:00:00', 'UTC'));

    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'destination' => 'library-of-memories',
        'legs' => [
            ['destination' => 'paris', 'duration_minutes' => 10],
            ['destination' => 'disney', 'duration_minutes' => 20],
            ['destination' => 'library-of-memories', 'duration_minutes' => 30],
        ],
    ]));

    $response->assertCreated()
        ->assertJsonPath('data.origin', 'port-of-dreams')
        ->assertJsonPath('data.destination', 'library-of-memories')
        ->assertJsonPath('data.route_legs.0.origin', 'port-of-dreams')
        ->assertJsonPath('data.route_legs.0.destination', 'paris')
        ->assertJsonPath('data.route_legs.1.starts_at', '2026-10-21T15:10:00.000000Z')
        ->assertJsonPath('data.route_legs.2.arrives_at', '2026-10-21T16:00:00.000000Z')
        ->assertJsonPath('data.arrives_at', '2026-10-21T16:00:00.000000Z');
});

it('creates an automatic narrative with timed steps and an optional location', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:00:00', 'UTC'));

    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'steps' => [
            [
                'title' => 'Buscando uma flor em Keukenhof',
                'description' => 'Uma lembrança especial para a viagem.',
                'duration_minutes' => 30,
                'location' => ['label' => 'Keukenhof', 'latitude' => 52.1326, 'longitude' => 4.5331],
            ],
            ['title' => 'Pausa para um croissant', 'description' => null, 'duration_minutes' => 15],
        ],
        'final_duration_minutes' => 15,
    ]));

    $response->assertCreated()
        ->assertJsonPath('data.steps.0.title', 'Buscando uma flor em Keukenhof')
        ->assertJsonPath('data.steps.0.location.latitude', 52.1326)
        ->assertJsonPath('data.steps.1.starts_at', '2026-10-21T15:30:00.000000Z')
        ->assertJsonPath('data.arrives_at', '2026-10-21T16:00:00.000000Z')
        ->assertJsonPath('data.current_step', 0);
});

it('reveals progressive adventure steps only as the delivery advances to the recipient', function () {
    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:20:00', 'UTC'));

    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'steps' => [
            ['title' => 'Primeira surpresa', 'duration_minutes' => 10],
            ['title' => 'Segunda surpresa', 'duration_minutes' => 20],
        ],
        'final_duration_minutes' => 10,
        'route_visibility' => 'progressive',
    ]))->assertCreated();

    $recipientToken = $response->json('recipient_access_token');
    $senderToken = $response->json('sender_access_token');
    $publicId = $response->json('data.public_id');

    $this->withToken($recipientToken)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertOk()
        ->assertJsonPath('data.route_visibility', 'progressive')
        ->assertJsonPath('data.hidden_steps_count', 1)
        ->assertJsonCount(1, 'data.steps')
        ->assertJsonCount(1, 'data.route_legs')
        ->assertJsonPath('data.steps.0.title', 'Primeira surpresa');

    $this->withToken($senderToken)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertOk()
        ->assertJsonPath('data.hidden_steps_count', 0)
        ->assertJsonCount(2, 'data.steps');

    CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-10-21 15:31:00', 'UTC'));
    $this->withToken($recipientToken)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertOk()
        ->assertJsonPath('data.hidden_steps_count', 0)
        ->assertJsonCount(2, 'data.steps');
});

it('uses the complete route visibility by default', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'steps' => [['title' => 'Parada aberta', 'duration_minutes' => 10]],
        'final_duration_minutes' => 10,
    ]))->assertCreated();

    expect($response->json('data.route_visibility'))->toBe('full');
});

it('rejects an unknown route visibility mode', function () {
    $this->postJson('/api/deliveries', deliveryPayload(['route_visibility' => 'hidden']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('route_visibility');
});

it('accepts real custom locations for the origin and destination', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'origin' => 'Casa de Lucas',
        'origin_location' => ['label' => 'Casa de Lucas', 'latitude' => -8.0472, 'longitude' => -34.8998],
        'destination' => 'Keukenhof',
        'destination_location' => ['label' => 'Keukenhof', 'latitude' => 52.1326, 'longitude' => 4.5331],
        'duration_minutes' => 90,
    ]));

    $response->assertCreated()
        ->assertJsonPath('data.origin', 'Casa de Lucas')
        ->assertJsonPath('data.origin_location.latitude', -8.0472)
        ->assertJsonPath('data.destination', 'Keukenhof')
        ->assertJsonPath('data.destination_location.longitude', 4.5331);
});

it('accepts custom endpoints with the same generated label when coordinates differ', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload([
        'origin' => 'Ponto escolhido no mapa',
        'origin_location' => ['label' => 'Ponto escolhido no mapa', 'latitude' => -8.30767396619585, 'longitude' => -34.8998],
        'destination' => 'Ponto escolhido no mapa',
        'destination_location' => ['label' => 'Ponto escolhido no mapa', 'latitude' => 0.2925015259327495, 'longitude' => -34.8998],
        'duration_minutes' => 1,
    ]));

    $response->assertCreated()
        ->assertJsonPath('data.origin_location.label', 'Ponto escolhido no mapa')
        ->assertJsonPath('data.destination_location.label', 'Ponto escolhido no mapa');
});

it('rejects route legs whose final stop differs from the delivery destination', function () {
    $this->postJson('/api/deliveries', deliveryPayload([
        'legs' => [['destination' => 'paris', 'duration_minutes' => 10]],
    ]))->assertUnprocessable()->assertJsonValidationErrors('legs');
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
        ])
        ->assertJsonPath('errors.message.0', 'O campo mensagem é obrigatório.')
        ->assertJsonPath('errors.recipient_name.0', 'O campo nome do destinatário é obrigatório.');
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
