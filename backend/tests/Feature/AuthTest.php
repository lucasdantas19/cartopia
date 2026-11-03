<?php

use App\Models\Delivery;
use App\Models\User;

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
