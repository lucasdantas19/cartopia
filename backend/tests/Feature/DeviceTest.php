<?php

use App\Models\User;

it('registers and revokes a mobile device for the authenticated user', function () {
    $user = User::factory()->create();
    $token = $this->postJson('/api/v1/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->json('token');

    $device = $this->withToken($token)
        ->postJson('/api/v1/account/devices', [
            'push_token' => 'ExponentPushToken[test-device]',
            'platform' => 'android',
            'device_name' => 'Teste',
        ])
        ->assertCreated()
        ->json('data');

    expect($device['registered'])->toBeTrue();

    $this->withToken($token)
        ->deleteJson('/api/v1/account/devices/'.$device['id'])
        ->assertOk()
        ->assertJsonPath('data.revoked', true);
});

it('does not allow one account to revoke another account device', function () {
    $owner = User::factory()->create();
    $ownerToken = $this->postJson('/api/v1/auth/login', [
        'email' => $owner->email,
        'password' => 'password',
    ])->json('token');
    $device = $this->withToken($ownerToken)
        ->postJson('/api/v1/account/devices', [
            'push_token' => 'ExponentPushToken[private-device]',
            'platform' => 'ios',
        ])
        ->json('data');

    $other = User::factory()->create();
    $otherToken = $this->postJson('/api/v1/auth/login', [
        'email' => $other->email,
        'password' => 'password',
    ])->json('token');

    $this->withToken($otherToken)
        ->deleteJson('/api/v1/account/devices/'.$device['id'])
        ->assertNotFound();
});
