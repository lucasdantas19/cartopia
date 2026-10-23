<?php

use App\Models\Delivery;
use Carbon\CarbonImmutable;

function retentionDelivery(CarbonImmutable $arrivesAt, array $overrides = []): Delivery
{
    return Delivery::create(array_merge([
        ...deliveryPayload(),
        'courier' => 'paper-swallow',
        'starts_at' => $arrivesAt->subHour(),
        'arrives_at' => $arrivesAt,
        'access_token_hash' => hash('sha256', 'recipient-retention-token'),
        'sender_access_token_hash' => hash('sha256', 'sender-retention-token'),
    ], $overrides));
}

it('does not prune recent or future deliveries', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $recent = retentionDelivery($now->subDays(89));
    $future = retentionDelivery($now->addMinute());

    $this->artisan('cartopia:prune-deliveries')->assertExitCode(0);

    expect(Delivery::find($recent->id))->not->toBeNull()
        ->and(Delivery::find($future->id))->not->toBeNull();
});

it('prunes a delivery at exactly the configured retention boundary', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $boundary = retentionDelivery($now->subDays(90));

    $this->artisan('cartopia:prune-deliveries')->assertExitCode(0);

    expect(Delivery::find($boundary->id))->toBeNull();
});

it('prunes deliveries older than the retention boundary in batches', function () {
    config()->set('deliveries.retention_batch_size', 1);
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $old = retentionDelivery($now->subDays(91));
    $older = retentionDelivery($now->subDays(120));

    $this->artisan('cartopia:prune-deliveries')
        ->expectsOutput('2 entrega(s) excluída(s).')
        ->assertExitCode(0);

    expect(Delivery::find($old->id))->toBeNull()
        ->and(Delivery::find($older->id))->toBeNull();
});

it('does not change records during a dry run', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $old = retentionDelivery($now->subDays(91));

    $this->artisan('cartopia:prune-deliveries', ['--dry-run' => true])
        ->expectsOutput('1 entrega(s) elegível(is) para exclusão.')
        ->assertExitCode(0);

    expect(Delivery::find($old->id))->not->toBeNull();
});

it('can be run again safely after pruning', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    retentionDelivery($now->subDays(91));

    $this->artisan('cartopia:prune-deliveries')->assertExitCode(0);
    $this->artisan('cartopia:prune-deliveries')
        ->expectsOutput('0 entrega(s) excluída(s).')
        ->assertExitCode(0);
});

it('removes access to a delivery after it is pruned', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $delivery = retentionDelivery($now->subDays(91));

    $this->artisan('cartopia:prune-deliveries')->assertExitCode(0);

    $this->withToken('recipient-retention-token')
        ->getJson('/api/deliveries/'.$delivery->public_id)
        ->assertNotFound();
});

it('does not leave related delivery records behind', function () {
    $now = CarbonImmutable::parse('2026-10-23 12:00:00', 'UTC');
    CarbonImmutable::setTestNow($now);
    $delivery = retentionDelivery($now->subDays(91));

    $this->artisan('cartopia:prune-deliveries')->assertExitCode(0);

    expect(Delivery::whereKey($delivery->id)->exists())->toBeFalse();
});
