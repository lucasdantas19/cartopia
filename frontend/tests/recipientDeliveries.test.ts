import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveriesForRecipient } from '../src/utils/recipientDeliveries.ts'

const deliveries = [
  { public_id: 'one', recipient_name: 'Ana', recipient_email: 'ANA@example.com', origin: 'A', destination: 'B', status: 'DELIVERED', progress: 100, starts_at: '', arrives_at: '' },
  { public_id: 'two', recipient_name: 'Ana', recipient_email: null, origin: 'A', destination: 'C', status: 'IN_TRANSIT', progress: 50, starts_at: '', arrives_at: '' },
  { public_id: 'three', recipient_name: 'Bruno', recipient_email: 'bruno@example.com', origin: 'A', destination: 'D', status: 'SCHEDULED', progress: 0, starts_at: '', arrives_at: '' },
]

test('filters saved recipient deliveries by email and keeps legacy name matches', () => {
  assert.deepEqual(
    deliveriesForRecipient(deliveries, { id: 1, name: 'Ana', email: 'ana@example.com', nickname: null }),
    [deliveries[0], deliveries[1]],
  )
})
