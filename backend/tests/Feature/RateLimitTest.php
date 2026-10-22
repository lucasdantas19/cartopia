<?php

use Carbon\CarbonImmutable;

function rateLimitDeliveryPayload(array $overrides = []): array
{
    return array_merge([
        'message' => 'Mensagem de teste de limite.',
        'sender_name' => 'Remetente',
        'recipient_name' => 'Destinatário',
        'origin' => 'port-of-dreams',
        'destination' => 'garden-of-ideas',
        'duration_minutes' => 60,
    ], $overrides);
}

function requestFromIp(string $ip)
{
    return test()->withServerVariables(['REMOTE_ADDR' => $ip]);
}

it('limits delivery creation by client IP and returns a consistent 429 response', function () {
    config()->set('rate_limits.delivery_creation', 2);
    $ip = '198.51.100.10';

    requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
    requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();

    $response = requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload());

    $response->assertStatus(429)
        ->assertJsonPath('error.code', 'RATE_LIMIT_EXCEEDED')
        ->assertJsonPath('error.message', 'Muitas tentativas. Aguarde um pouco e tente novamente.')
        ->assertHeader('Retry-After');
});

it('keeps endpoint limits independent for the same client IP', function () {
    config()->set('rate_limits.delivery_creation', 1);
    config()->set('rate_limits.delivery_tracking', 1);
    $ip = '198.51.100.11';

    $created = requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
    $publicId = $created->json('data.public_id');
    $token = $created->json('recipient_access_token');

    requestFromIp($ip)->withToken($token)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertOk();

    requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertStatus(429);
    requestFromIp($ip)->withToken($token)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertStatus(429);
});

it('does not share a creation limit between different client IPs', function () {
    config()->set('rate_limits.delivery_creation', 1);

    requestFromIp('198.51.100.12')->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
    requestFromIp('198.51.100.13')->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
});

it('limits message opening independently from tracking', function () {
    config()->set('rate_limits.message_opening', 1);
    $ip = '198.51.100.14';
    $created = requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload(['duration_minutes' => 1]))->assertCreated();
    $publicId = $created->json('data.public_id');
    $token = $created->json('recipient_access_token');

    CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinutes(2));

    requestFromIp($ip)->withToken($token)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertOk();
    requestFromIp($ip)->withToken($token)
        ->getJson('/api/deliveries/'.$publicId.'/message')
        ->assertOk();
    requestFromIp($ip)->withToken($token)
        ->getJson('/api/deliveries/'.$publicId.'/message')
        ->assertStatus(429);
});

it('limits private channel authorization by client IP', function () {
    config()->set('rate_limits.broadcasting_auth', 1);
    $ip = '198.51.100.15';
    $created = requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
    $publicId = $created->json('data.public_id');
    $token = $created->json('sender_access_token');
    $payload = [
        'channel_name' => 'private-deliveries.'.$publicId.'.sender',
        'socket_id' => '1234.5678',
    ];

    requestFromIp($ip)->withToken($token)
        ->postJson('/api/broadcasting/auth', $payload)
        ->assertOk();
    requestFromIp($ip)->withToken($token)
        ->postJson('/api/broadcasting/auth', $payload)
        ->assertStatus(429);
});

it('allows a client to continue after the rate limit window', function () {
    config()->set('rate_limits.delivery_creation', 1);
    $ip = '198.51.100.16';

    requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
    CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinute()->addSecond());

    requestFromIp($ip)->postJson('/api/deliveries', rateLimitDeliveryPayload())->assertCreated();
});
