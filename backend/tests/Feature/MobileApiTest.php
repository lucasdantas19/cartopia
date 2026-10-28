<?php

it('exposes the versioned mobile api health endpoint', function () {
    $this->getJson('/api/v1/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok', 'version' => 'v1']);
});
