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

    $anonymous = $this->postJson('/api/deliveries', deliveryPayload())->assertCreated();
    expect(Delivery::find(1)->user_id)->toBeNull();

    $this->withToken($token)->postJson('/api/deliveries', deliveryPayload(['recipient_name' => 'Pessoa autenticada']))->assertCreated();
    expect(Delivery::where('user_id', $user->id)->count())->toBe(1);
    $this->withToken($token)->getJson('/api/account/deliveries')->assertJsonCount(1, 'data');
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
