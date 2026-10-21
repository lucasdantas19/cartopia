<?php

it('returns the api health status', function () {
    $this->getJson('/api/health', ['Origin' => 'http://localhost:5173'])
        ->assertOk()
        ->assertExactJson(['status' => 'ok'])
        ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
});
