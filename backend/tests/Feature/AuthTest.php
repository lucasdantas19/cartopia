<?php

use App\Models\Delivery;
use App\Models\User;
use Carbon\CarbonImmutable;

it('registers and authenticates a user without exposing the token hash', function () {
    $response = $this->postJson('/api/auth/register', [
        'name' => 'Lucas', 'email' => 'lucas@example.com', 'password' => 'password123',
    ])->assertCreated();

    $token = $response->json('token');
    expect($token)->toBeString()->and($response->json('data.email'))->toBe('lucas@example.com');
    expect(User::first()->api_token_hash)->toBe(hash('sha256', $token));

    $this->withToken($token)->getJson('/api/auth/me')->assertOk()->assertJsonPath('data.name', 'Lucas');
});

it('keeps account data private and allows anonymous deliveries', function () {
    $user = User::factory()->create();
    $login = $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => 'password'])->assertOk();
    $token = $login->json('token');

    $this->getJson('/api/account/deliveries')->assertUnauthorized();
    $this->withToken($token)->getJson('/api/account/deliveries')->assertOk()->assertJsonCount(0, 'data');

    $anonymous = $this->withHeaders(['Authorization' => ''])->postJson('/api/deliveries', deliveryPayload())->assertCreated();
    expect(Delivery::where('public_id', $anonymous->json('data.public_id'))->firstOrFail()->user_id)->toBeNull();

    $this->withToken($token)->postJson('/api/deliveries', deliveryPayload(['recipient_name' => 'Pessoa autenticada']))->assertCreated();
    expect(Delivery::where('user_id', $user->id)->count())->toBe(1);
    $this->withToken($token)->getJson('/api/account/deliveries')->assertJsonCount(1, 'data');
});

it('rejects an expired account token when creating a delivery', function () {
    $user = User::factory()->create();
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email, 'password' => 'password',
    ])->json('token');
    $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

    $this->withToken($token)->postJson('/api/v1/deliveries', deliveryPayload())
        ->assertUnauthorized()->assertJsonPath('error.code', 'UNAUTHENTICATED');
    expect(Delivery::count())->toBe(0);
});

it('shows only the five newest active deliveries associated with the account on the map', function () {
    $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
    $user = User::factory()->create(['email' => 'ana@example.com']);
    $other = User::factory()->create();
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email, 'password' => 'password',
    ])->json('token');
    $now = CarbonImmutable::now('UTC');
    $ids = [];

    for ($index = 0; $index < 7; $index++) {
        $created = $this->postJson('/api/v1/deliveries', deliveryPayload([
            'recipient_email' => 'ANA@example.com',
        ]))->assertCreated();
        $id = $created->json('data.public_id');
        Delivery::where('public_id', $id)->update([
            'starts_at' => $now->subMinutes(5),
            'arrives_at' => $now->addMinutes(30),
            'created_at' => $now->addSeconds($index),
        ]);
        $ids[] = $id;
    }

    $this->withToken($token)->postJson('/api/v1/deliveries', deliveryPayload())->assertCreated();
    $unrelated = $this->withHeaders(['Authorization' => ''])->postJson('/api/v1/deliveries', deliveryPayload())->assertCreated();
    Delivery::where('public_id', $unrelated->json('data.public_id'))->update([
        'starts_at' => $now->subMinutes(5), 'arrives_at' => $now->addMinutes(30),
    ]);

    $this->getJson('/api/v1/account/active-map-deliveries')->assertUnauthorized();
    $response = $this->withToken($token)->getJson('/api/v1/account/active-map-deliveries')
        ->assertOk()->assertJsonCount(5, 'data');
    expect(array_column($response->json('data'), 'public_id'))->toBe(array_reverse(array_slice($ids, 2)));
    expect($response->json('data.0.status'))->toBe('IN_TRANSIT');
    expect($response->json('data.0'))->toHaveKeys(['origin_location', 'destination_location', 'starts_at', 'arrives_at', 'courier']);
    $otherToken = $this->postJson('/api/v1/auth/login', [
        'email' => $other->email, 'password' => 'password',
    ])->json('token');
    $this->withToken($otherToken)->getJson('/api/v1/account/active-map-deliveries')->assertJsonCount(0, 'data');
});

it('includes sent and explicitly tracked active deliveries once each', function () {
    $user = User::factory()->create(['email' => 'ana@example.com']);
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email, 'password' => 'password',
    ])->json('token');
    $sent = $this->withToken($token)->postJson('/api/v1/deliveries', deliveryPayload([
        'recipient_email' => 'ana@example.com',
    ]))->assertCreated();
    $tracked = $this->withHeaders(['Authorization' => ''])->postJson('/api/v1/deliveries', deliveryPayload())->assertCreated();
    $now = CarbonImmutable::now('UTC');
    Delivery::query()->update(['starts_at' => $now->subMinute(), 'arrives_at' => $now->addHour()]);

    $this->withToken($token)->postJson('/api/v1/account/tracked-deliveries', [
        'public_id' => $tracked->json('data.public_id'),
        'access_token' => $tracked->json('recipient_access_token'),
    ])->assertCreated();

    $response = $this->withToken($token)->getJson('/api/v1/account/active-map-deliveries')
        ->assertOk()->assertJsonCount(2, 'data');
    expect(array_column($response->json('data'), 'public_id'))
        ->toContain($sent->json('data.public_id'), $tracked->json('data.public_id'));
});

it('lets an account owner follow their sent delivery without exposing recipient content', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $ownerToken = $this->postJson('/api/v1/auth/login', ['email' => $owner->email, 'password' => 'password'])->json('token');
    $otherToken = $this->postJson('/api/v1/auth/login', ['email' => $other->email, 'password' => 'password'])->json('token');
    $created = $this->withToken($ownerToken)->postJson('/api/v1/deliveries', deliveryPayload())->assertCreated();
    $publicId = $created->json('data.public_id');

    $this->withToken($ownerToken)->getJson('/api/v1/deliveries/'.$publicId)
        ->assertOk()->assertJsonPath('data.access_role', 'sender');
    $this->withToken($ownerToken)->getJson('/api/v1/deliveries/'.$publicId.'/recipient-share-link')
        ->assertOk()->assertJsonPath('data.recipient_access_token', $created->json('recipient_access_token'));
    Delivery::where('public_id', $publicId)->update(['sender_access_token_hash' => null]);
    $this->withToken($ownerToken)->getJson('/api/v1/deliveries/'.$publicId)
        ->assertOk()->assertJsonPath('data.access_role', 'sender');
    $this->withToken($ownerToken)->getJson('/api/v1/deliveries/'.$publicId.'/message')->assertNotFound();
    $this->withToken($otherToken)->getJson('/api/v1/deliveries/'.$publicId)->assertNotFound();
    $this->withToken($otherToken)->getJson('/api/v1/deliveries/'.$publicId.'/recipient-share-link')->assertNotFound();

    $this->withToken($ownerToken)->postJson('/api/v1/auth/logout')->assertOk();
    $this->withToken($ownerToken)->getJson('/api/v1/deliveries/'.$publicId)->assertNotFound();
});

it('stores saved recipients and locations only for their owner', function () {
    $first = User::factory()->create();
    $second = User::factory()->create();
    $firstToken = $this->postJson('/api/auth/login', ['email' => $first->email, 'password' => 'password'])->json('token');
    $secondToken = $this->postJson('/api/auth/login', ['email' => $second->email, 'password' => 'password'])->json('token');

    $location = $this->withToken($firstToken)->postJson('/api/account/locations', ['name' => 'Casa', 'label' => 'Meu endereço', 'latitude' => -8, 'longitude' => -34])->assertCreated()->json('data');
    $recipient = $this->withToken($firstToken)->postJson('/api/account/recipients', ['name' => 'Ana'])->assertCreated()->json('data');

    $this->withToken($secondToken)->getJson('/api/account/locations')->assertJsonCount(0, 'data');
    $this->withToken($secondToken)->deleteJson('/api/account/locations/'.$location['id'])->assertNotFound();
    $this->withToken($secondToken)->deleteJson('/api/account/recipients/'.$recipient['id'])->assertNotFound();
});

it('allows an account to configure and change its default location', function () {
    $user = User::factory()->create();
    $token = $this->postJson('/api/auth/login', [
        'email' => $user->email, 'password' => 'password',
    ])->json('token');

    $first = $this->withToken($token)->postJson('/api/account/locations', [
        'name' => 'Casa', 'label' => 'Meu endereço', 'latitude' => -8, 'longitude' => -34, 'is_default' => true,
    ])->assertCreated()->json('data');
    $second = $this->withToken($token)->postJson('/api/account/locations', [
        'name' => 'Escritório', 'label' => 'Meu trabalho', 'latitude' => -9, 'longitude' => -35,
    ])->assertCreated()->json('data');

    expect($first['is_default'])->toBeTrue();
    expect($second['is_default'])->toBeFalse();

    $this->withToken($token)->putJson('/api/account/locations/'.$second['id'].'/default')
        ->assertOk()->assertJsonPath('data.is_default', true);
    $locations = $this->withToken($token)->getJson('/api/account/locations')
        ->assertOk()->json('data');
    expect(collect($locations)->firstWhere('id', $second['id'])['is_default'])->toBeTrue();
    expect(collect($locations)->firstWhere('id', $first['id'])['is_default'])->toBeFalse();
});

it('associates a delivery link with the authenticated account and protects it from other users', function () {
    $owner = User::factory()->create();
    $other = User::factory()->create();
    $ownerToken = $this->postJson('/api/auth/login', ['email' => $owner->email, 'password' => 'password'])->json('token');
    $otherToken = $this->postJson('/api/auth/login', ['email' => $other->email, 'password' => 'password'])->json('token');
    $delivery = $this->postJson('/api/deliveries', deliveryPayload())->assertCreated();

    $this->withToken($ownerToken)->postJson('/api/account/tracked-deliveries', [
        'public_id' => $delivery->json('data.public_id'),
        'access_token' => $delivery->json('recipient_access_token'),
        'label' => 'Carta importante',
    ])->assertCreated();

    $this->withToken($ownerToken)->getJson('/api/account/tracked-deliveries')->assertOk()->assertJsonPath('data.0.label', 'Carta importante');
    $this->withToken($otherToken)->getJson('/api/account/tracked-deliveries')->assertOk()->assertJsonCount(0, 'data');
    $this->withToken($ownerToken)->postJson('/api/account/tracked-deliveries', [
        'public_id' => $delivery->json('data.public_id'), 'access_token' => 'token-invalido',
    ])->assertUnprocessable()->assertJsonPath('error.code', 'INVALID_DELIVERY_LINK');
});

it('shows deliveries addressed to a registered recipient in their account', function () {
    $recipient = User::factory()->create(['email' => 'ana@example.com']);
    $recipientToken = $this->postJson('/api/auth/login', ['email' => 'ana@example.com', 'password' => 'password'])->json('token');

    $this->postJson('/api/deliveries', deliveryPayload([
        'recipient_name' => 'Ana', 'recipient_email' => 'ANA@example.com',
    ]))->assertCreated();

    $this->withToken($recipientToken)->getJson('/api/account/incoming-deliveries')
        ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.recipient_name', 'Ana');
    $this->withToken($recipientToken)->getJson('/api/account/incoming-deliveries/'.Delivery::first()->public_id.'/token')
        ->assertOk()->assertJsonPath('data.role', 'recipient');
});

it('lets the email recipient open an arrived message with their account session', function () {
    $recipient = User::factory()->create(['email' => 'ana@example.com']);
    $other = User::factory()->create();
    $recipientToken = $this->postJson('/api/v1/auth/login', [
        'email' => $recipient->email, 'password' => 'password',
    ])->json('token');
    $otherToken = $this->postJson('/api/v1/auth/login', [
        'email' => $other->email, 'password' => 'password',
    ])->json('token');
    $created = $this->postJson('/api/v1/deliveries', deliveryPayload([
        'recipient_email' => 'ANA@example.com',
        'message' => 'Mensagem privada para Ana',
        'duration_minutes' => 1,
    ]))->assertCreated();
    $publicId = $created->json('data.public_id');

    $this->withToken($recipientToken)->getJson('/api/v1/deliveries/'.$publicId)
        ->assertOk()->assertJsonPath('data.access_role', 'recipient')->assertDontSee('Mensagem privada para Ana');
    $this->withToken($recipientToken)->getJson('/api/v1/deliveries/'.$publicId.'/message')
        ->assertForbidden()->assertJsonPath('error.code', 'DELIVERY_NOT_ARRIVED');
    $this->withToken($otherToken)->getJson('/api/v1/deliveries/'.$publicId)->assertNotFound();
    $this->withToken($otherToken)->getJson('/api/v1/deliveries/'.$publicId.'/message')->assertNotFound();

    CarbonImmutable::setTestNow(CarbonImmutable::now()->addMinutes(2));

    $this->withToken($recipientToken)->getJson('/api/v1/deliveries/'.$publicId.'/message')
        ->assertOk()->assertJsonPath('data.message', 'Mensagem privada para Ana');
    $this->withToken($recipientToken)->postJson('/api/v1/auth/logout')->assertOk();
    $this->withToken($recipientToken)->getJson('/api/v1/deliveries/'.$publicId.'/message')->assertNotFound();
});

it('gives a matching account the recipient role when sending to their own email', function () {
    $user = User::factory()->create(['email' => 'ana@example.com']);
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email, 'password' => 'password',
    ])->json('token');
    $created = $this->withToken($token)->postJson('/api/v1/deliveries', deliveryPayload([
        'recipient_email' => 'ANA@example.com',
    ]))->assertCreated();

    $this->withToken($token)->getJson('/api/v1/deliveries/'.$created->json('data.public_id'))
        ->assertOk()->assertJsonPath('data.access_role', 'recipient');
    $this->withToken($token)->getJson('/api/v1/deliveries/'.$created->json('data.public_id').'?role=sender')
        ->assertOk()->assertJsonPath('data.access_role', 'sender');
    $this->withToken($token)->getJson('/api/v1/deliveries/'.$created->json('data.public_id').'/recipient-share-link')
        ->assertOk();
});
