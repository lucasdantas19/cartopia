<?php

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
