<?php

use App\Models\Delivery;

beforeEach(function () {
    config(['deliveries.admin_token' => 'test-admin-token']);
});

it('protects the admin delivery endpoints', function () {
    $this->getJson('/api/admin/deliveries')->assertUnauthorized();
    $this->withToken('wrong-token')->getJson('/api/admin/deliveries')->assertUnauthorized();
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
