import assert from 'node:assert/strict'
import test from 'node:test'
import type { ActiveMapDelivery } from '../src/services/api.ts'
import { activeMapPosition, activeMapRoute } from '../src/components/account/activeMapRoutes.ts'

const delivery: ActiveMapDelivery = {
  public_id: 'example',
  recipient_name: 'Ana',
  courier: 'postal-cat',
  origin: 'Recife',
  destination: 'Olinda',
  origin_location: { label: 'Recife', latitude: -8, longitude: -35 },
  destination_location: { label: 'Olinda', latitude: -7, longitude: -34 },
  starts_at: '2026-11-04T12:00:00Z',
  arrives_at: '2026-11-04T12:10:00Z',
  status: 'IN_TRANSIT',
  progress: 20,
}

test('estimates the position of each active delivery between real coordinates', () => {
  assert.deepEqual(activeMapRoute(delivery), { origin: [-35, -8], destination: [-34, -7] })
  assert.deepEqual(activeMapPosition(delivery, Date.parse('2026-11-04T12:05:00Z')), [-34.5, -7.5])
  assert.deepEqual(activeMapPosition(delivery, Date.parse('2026-11-04T12:20:00Z')), [-34, -7])
})

test('skips deliveries without usable map coordinates', () => {
  assert.equal(activeMapRoute({ ...delivery, origin_location: null }), null)
  assert.equal(activeMapRoute({ ...delivery, destination_location: delivery.origin_location }), null)
  assert.equal(activeMapRoute({
    ...delivery,
    destination_location: { label: 'Inválido', latitude: 200, longitude: 0 },
  }), null)
})
