<?php

use App\Models\Delivery;

it('exposes the versioned mobile api health endpoint', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok', 'version' => 'v1']);
});

it('creates a versioned delivery with real origin and destination selected on the map', function () {
    $origin = [
        'label' => 'Marco Zero',
        'latitude' => -8.0631,
        'longitude' => -34.8711,
    ];
    $destination = [
        'label' => 'Parque da Jaqueira',
        'latitude' => -8.0362,
        'longitude' => -34.9021,
    ];

    $this->postJson('/api/v1/deliveries', deliveryPayload([
        'origin' => $origin['label'],
        'origin_location' => $origin,
        'destination' => $destination['label'],
        'destination_location' => $destination,
    ]))
        ->assertCreated()
        ->assertJsonPath('data.origin', $origin['label'])
        ->assertJsonPath('data.origin_location', $origin)
        ->assertJsonPath('data.destination', $destination['label'])
        ->assertJsonPath('data.destination_location', $destination);
});

it('rejects equal real map points in the versioned delivery api', function () {
    $point = ['label' => 'Mesmo ponto', 'latitude' => -8.0631, 'longitude' => -34.8711];

    $this->postJson('/api/v1/deliveries', deliveryPayload([
        'origin' => $point['label'],
        'origin_location' => $point,
        'destination' => $point['label'],
        'destination_location' => $point,
    ]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('destination');
});

it('lets the sender recover the recipient link token for sharing again', function () {
    $created = $this->postJson('/api/v1/deliveries', deliveryPayload());
    $created->assertCreated();

    $publicId = $created->json('data.public_id');
    $recipientToken = $created->json('recipient_access_token');
    $senderToken = $created->json('sender_access_token');

    $response = $this->withToken($senderToken)
        ->getJson('/api/v1/deliveries/'.$publicId.'/recipient-share-link');

    $response
        ->assertOk()
        ->assertJsonPath('data.public_id', $publicId)
        ->assertJsonPath('data.recipient_access_token', $recipientToken)
        ->assertJsonMissing(['sender_access_token' => $senderToken]);

    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('does not reveal the recipient link to a recipient or an invalid token', function () {
    $created = $this->postJson('/api/v1/deliveries', deliveryPayload());
    $created->assertCreated();

    $path = '/api/v1/deliveries/'.$created->json('data.public_id').'/recipient-share-link';

    $this->withToken($created->json('recipient_access_token'))
        ->getJson($path)
        ->assertNotFound();

    $this->withToken('invalid-token')
        ->getJson($path)
        ->assertNotFound();
});

it('reports when an older delivery has no recoverable recipient link', function () {
    $created = $this->postJson('/api/v1/deliveries', deliveryPayload());
    $created->assertCreated();

    Delivery::where('public_id', $created->json('data.public_id'))
        ->update(['recipient_access_token_encrypted' => null]);

    $this->withToken($created->json('sender_access_token'))
        ->getJson('/api/v1/deliveries/'.$created->json('data.public_id').'/recipient-share-link')
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'SHARE_LINK_UNAVAILABLE');
});
