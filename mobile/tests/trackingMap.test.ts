import assert from 'node:assert/strict'
import test from 'node:test'
import type { Delivery } from '../src/domain.ts'
import { deliveryMapRoute, estimatedMapProgress, pointAlongRoute } from '../src/trackingMap.ts'

const delivery: Delivery = {
  public_id: 'test-delivery',
  sender_name: 'Ana',
  recipient_name: 'Bia',
  origin: 'Recife',
  origin_location: { label: 'Recife', latitude: -8.06, longitude: -34.88 },
  destination: 'Olinda',
  destination_location: { label: 'Olinda', latitude: -7.99, longitude: -34.85 },
  starts_at: '2026-11-03T12:00:00.000Z',
  arrives_at: '2026-11-03T12:10:00.000Z',
  status: 'IN_TRANSIT',
  progress: 20,
  current_step: 0,
  courier: 'postal-cat',
  access_role: 'sender',
}

test('shows the map only for deliveries with valid real coordinates', () => {
  assert.deepEqual(deliveryMapRoute(delivery), {
    origin: { latitude: -8.06, longitude: -34.88 },
    destination: { latitude: -7.99, longitude: -34.85 },
  })
  assert.equal(deliveryMapRoute({ ...delivery, origin_location: null }), null)
  assert.equal(deliveryMapRoute({ ...delivery, destination_location: delivery.origin_location }), null)
  assert.equal(deliveryMapRoute({
    ...delivery,
    destination_location: { label: 'Inválido', latitude: 200, longitude: 0 },
  }), null)
})

test('moves the illustrative courier from origin to destination as time passes', () => {
  const fetchedAt = Date.parse('2026-11-03T12:02:00.000Z')
  const now = fetchedAt + 60_000
  const route = deliveryMapRoute(delivery)!
  const progress = estimatedMapProgress(delivery, fetchedAt, now)

  assert.equal(progress, 30)
  assert.deepEqual(pointAlongRoute(route.origin, route.destination, 0), route.origin)
  assert.deepEqual(pointAlongRoute(route.origin, route.destination, 100), route.destination)
  assert.ok(pointAlongRoute(route.origin, route.destination, progress).latitude > route.origin.latitude)
  assert.equal(estimatedMapProgress({ ...delivery, status: 'SCHEDULED' }, fetchedAt, now), 0)
  assert.equal(estimatedMapProgress({ ...delivery, status: 'DELIVERED' }, fetchedAt, now), 100)
})
