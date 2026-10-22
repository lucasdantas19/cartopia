import assert from 'node:assert/strict'
import test from 'node:test'
import { createShareUrl, extractTokenFromFragment, removeAccessToken, resolveAccessToken, tokenStorageKey } from '../src/accessToken.ts'
import { formatLocalDate, progressFromTime, statusFromTime } from '../src/dateTime.ts'
import type { Delivery } from '../src/types.ts'

const delivery: Delivery = {
  public_id: 'test',
  sender_name: null,
  recipient_name: 'Pessoa querida',
  origin: 'port-of-dreams',
  destination: 'garden-of-ideas',
  courier: 'paper-swallow',
  starts_at: '2026-10-21T15:00:00.000000Z',
  arrives_at: '2026-10-21T15:05:00.000000Z',
  status: 'IN_TRANSIT',
  progress: 0,
}

test('calculates progress from UTC instants without a manual offset', () => {
  assert.equal(progressFromTime(delivery, Date.parse('2026-10-21T15:02:30Z')), 50)
  assert.equal(statusFromTime(delivery, Date.parse('2026-10-21T15:04:59Z')), 'IN_TRANSIT')
  assert.equal(statusFromTime(delivery, Date.parse('2026-10-21T15:05:00Z')), 'DELIVERED')
})

test('formats a UTC instant in UTC-3 local time', () => {
  assert.match(formatLocalDate(delivery.arrives_at, 'America/Sao_Paulo'), /21 de out\. de 2026, 12:05/)
})

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

test('extracts and persists a token from the fragment', () => {
  const storage = new MemoryStorage()

  assert.equal(extractTokenFromFragment('#token=first-token'), 'first-token')
  assert.deepEqual(resolveAccessToken('delivery-a', '#token=first-token', storage), { token: 'first-token', fromFragment: true })
  assert.equal(storage.getItem(tokenStorageKey('delivery-a')), 'first-token')
})

test('recovers tokens after reload and isolates them by delivery', () => {
  const storage = new MemoryStorage()
  resolveAccessToken('delivery-a', '#token=token-a', storage)
  resolveAccessToken('delivery-b', '#token=token-b', storage)

  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: 'token-a', fromFragment: false })
  assert.deepEqual(resolveAccessToken('delivery-b', '', storage), { token: 'token-b', fromFragment: false })
})

test('replaces an existing token when a new link is opened', () => {
  const storage = new MemoryStorage()
  resolveAccessToken('delivery-a', '#token=old-token', storage)

  resolveAccessToken('delivery-a', '#token=new-token', storage)

  assert.equal(storage.getItem(tokenStorageKey('delivery-a')), 'new-token')
})

test('reports missing tokens and removes invalid credentials', () => {
  const storage = new MemoryStorage()

  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: null, fromFragment: false })
  resolveAccessToken('delivery-a', '#token=invalid-token', storage)
  removeAccessToken('delivery-a', storage)
  assert.equal(storage.getItem(tokenStorageKey('delivery-a')), null)
})

test('preserves the complete shareable link with the token in the fragment', () => {
  const url = createShareUrl('https://cartopia.example/', 'delivery/a', 'token-value')

  assert.equal(url, 'https://cartopia.example/d/delivery%2Fa#token=token-value')
  assert.equal(new URL(url).search, '')
  assert.equal(new URL(url).hash, '#token=token-value')
})
