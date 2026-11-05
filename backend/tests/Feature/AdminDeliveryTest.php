<?php

use App\Models\Delivery;
use App\Models\User;

beforeEach(function () {
    config(['deliveries.admin_token' => 'test-admin-token']);
});

it('protects the admin delivery endpoints', function () {
    $this->getJson('/api/admin/deliveries')->assertUnauthorized();
    $this->withToken('wrong-token')->getJson('/api/admin/deliveries')->assertUnauthorized();
});

it('protects the admin user endpoints', function () {
    $this->getJson('/api/admin/users')->assertUnauthorized();
    $this->withToken('wrong-token')->getJson('/api/admin/users')->assertUnauthorized();
});

it('lists a user with saved locations and related deliveries', function () {
    $user = User::factory()->create([
        'name' => 'Pessoa cadastrada',
        'email' => 'pessoa@example.com',
    ]);
    $user->savedLocations()->create([
        'name' => 'Casa',
        'label' => 'Casa da pessoa',
        'latitude' => -8.05,
        'longitude' => -34.9,
        'is_default' => true,
    ]);
    $userToken = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->json('token');

    $created = $this->withToken($userToken)
        ->postJson('/api/deliveries', deliveryPayload())
        ->assertCreated();

    $this->withToken($userToken)
        ->postJson('/api/account/tracked-deliveries', [
            'public_id' => $created->json('data.public_id'),
            'access_token' => $created->json('access_token'),
            'role' => 'recipient',
            'label' => 'Acompanhamento de teste',
        ])
        ->assertCreated();

    $list = $this->withToken('test-admin-token')
        ->getJson('/api/admin/users?q=pessoa@example.com')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.name', 'Pessoa cadastrada')
        ->assertJsonPath('data.0.locations_count', 1)
        ->assertJsonPath('data.0.sent_deliveries_count', 1)
        ->assertJsonPath('data.0.tracked_deliveries_count', 1);

    $this->withToken('test-admin-token')
        ->getJson('/api/admin/users/'.$list->json('data.0.id'))
        ->assertOk()
        ->assertJsonPath('data.email', 'pessoa@example.com')
        ->assertJsonPath('data.locations.0.name', 'Casa')
        ->assertJsonPath('data.sent_deliveries.0.public_id', $created->json('data.public_id'))
        ->assertJsonPath('data.tracked_deliveries.0.label', 'Acompanhamento de teste')
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.api_token_hash');
});

it('filters deliveries requested without an account', function () {
    $anonymous = createDelivery()[0];
    $user = User::factory()->create();
    $userToken = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->json('token');
    $accountDelivery = $this->withToken($userToken)
        ->postJson('/api/deliveries', deliveryPayload(['recipient_name' => 'Conta']))
        ->assertCreated()
        ->json('data');

    $this->withToken('test-admin-token')
        ->getJson('/api/admin/deliveries?owner=anonymous')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.public_id', $anonymous['public_id'])
        ->assertJsonPath('data.0.requester_type', 'anonymous')
        ->assertJsonMissing(['public_id' => $accountDelivery['public_id']]);
});

it('filters deliveries requested by users and by creation date', function () {
    $anonymous = createDelivery()[0];
    Delivery::where('public_id', $anonymous['public_id'])->update([
        'created_at' => now()->subDays(3),
    ]);

    $user = User::factory()->create();
    $userToken = $this->postJson('/api/auth/login', [
        'email' => $user->email,
        'password' => 'password',
    ])->json('token');
    $accountDelivery = $this->withToken($userToken)
        ->postJson('/api/deliveries', deliveryPayload(['recipient_name' => 'Usuário']))
        ->assertCreated()
        ->json('data');

    $this->withToken('test-admin-token')
        ->getJson('/api/admin/deliveries?owner=account')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.public_id', $accountDelivery['public_id'])
        ->assertJsonPath('data.0.requester_type', 'account');

    $this->withToken('test-admin-token')
        ->getJson('/api/admin/deliveries?date_from='.now()->subDay()->toDateString())
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.public_id', $accountDelivery['public_id']);
});

it('lists deliveries and regenerates links while invalidating previous tokens', function () {
    $response = $this->postJson('/api/deliveries', deliveryPayload())->assertCreated();
    $publicId = $response->json('data.public_id');
    $oldRecipientToken = $response->json('recipient_access_token');

    $this->withToken('test-admin-token')
        ->getJson('/api/admin/deliveries?q=Pessoa%20querida')
        ->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonPath('data.0.public_id', $publicId);

    $links = $this->withToken('test-admin-token')
        ->postJson('/api/admin/deliveries/'.$publicId.'/regenerate-links')
        ->assertOk()
        ->json('data');

    expect($links['recipient_path'])->toContain('/d/'.$publicId.'#token=')
        ->and($links['sender_path'])->toContain('&role=sender');

    $this->withToken($oldRecipientToken)
        ->getJson('/api/deliveries/'.$publicId)
        ->assertNotFound();
});

it('deletes a delivery from the admin panel', function () {
    [$data] = createDelivery();

    $this->withToken('test-admin-token')
        ->deleteJson('/api/admin/deliveries/'.$data['public_id'])
        ->assertOk()
        ->assertJsonPath('data.deleted', true);

    expect(Delivery::where('public_id', $data['public_id'])->exists())->toBeFalse();
});
