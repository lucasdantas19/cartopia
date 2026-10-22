import assert from 'node:assert/strict'
import test from 'node:test'
import { activeRoleStorageKey, createShareUrl, extractTokenFromFragment, removeAccessToken, resolveAccessToken, tokenStorageKey } from '../src/accessToken.ts'
import { formatLocalDate, progressFromTime, progressRatioFromInstants, statusFromTime } from '../src/dateTime.ts'
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
  opened_at: null,
  access_role: 'recipient',
}

test('calculates progress from UTC instants without a manual offset', () => {
  assert.equal(progressFromTime(delivery, Date.parse('2026-10-21T15:02:30Z')), 50)
  assert.equal(statusFromTime(delivery, Date.parse('2026-10-21T15:04:59Z')), 'IN_TRANSIT')
  assert.equal(statusFromTime(delivery, Date.parse('2026-10-21T15:05:00Z')), 'DELIVERED')
})

test('returns a normalized temporal progress ratio', () => {
  const startsAt = '2026-10-21T15:00:00Z'
  const arrivesAt = '2026-10-21T15:05:00Z'

  assert.equal(progressRatioFromInstants(startsAt, arrivesAt, Date.parse(startsAt)), 0)
  assert.equal(progressRatioFromInstants(startsAt, arrivesAt, Date.parse('2026-10-21T15:02:30Z')), 0.5)
  assert.equal(progressRatioFromInstants(startsAt, arrivesAt, Date.parse(arrivesAt)), 1)
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
  assert.deepEqual(resolveAccessToken('delivery-a', '#token=first-token', storage), { token: 'first-token', role: 'recipient', fromFragment: true })
  assert.equal(storage.getItem(tokenStorageKey('delivery-a')), 'first-token')
  assert.equal(storage.getItem(activeRoleStorageKey('delivery-a')), 'recipient')
})

test('recovers tokens after reload and isolates them by delivery', () => {
  const storage = new MemoryStorage()
  resolveAccessToken('delivery-a', '#token=token-a', storage)
  resolveAccessToken('delivery-b', '#token=token-b', storage)

  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: 'token-a', role: 'recipient', fromFragment: false })
  assert.deepEqual(resolveAccessToken('delivery-b', '', storage), { token: 'token-b', role: 'recipient', fromFragment: false })
})

test('replaces an existing token when a new link is opened', () => {
  const storage = new MemoryStorage()
  resolveAccessToken('delivery-a', '#token=old-token', storage)

  resolveAccessToken('delivery-a', '#token=new-token', storage)

  assert.equal(storage.getItem(tokenStorageKey('delivery-a')), 'new-token')
})

test('reports missing tokens and removes invalid credentials', () => {
  const storage = new MemoryStorage()

  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: null, role: 'recipient', fromFragment: false })
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

test('isolates sender credentials and marks sender links', () => {
  const storage = new MemoryStorage()

  assert.deepEqual(resolveAccessToken('delivery-a', '#token=sender-token&role=sender', storage), {
    token: 'sender-token',
    role: 'sender',
    fromFragment: true,
  })
  assert.equal(storage.getItem(tokenStorageKey('delivery-a', 'sender')), 'sender-token')
  assert.equal(storage.getItem(tokenStorageKey('delivery-a', 'recipient')), null)
  assert.match(createShareUrl('https://cartopia.example', 'delivery-a', 'sender-token', 'sender'), /#token=sender-token&role=sender$/)
})

test('recovers the sender token after the fragment is removed', () => {
  const storage = new MemoryStorage()

  resolveAccessToken('delivery-a', '#token=sender-token&role=sender', storage)

  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), {
    token: 'sender-token',
    role: 'sender',
    fromFragment: false,
  })
})

test('keeps sender and recipient tokens isolated when switching links', () => {
  const storage = new MemoryStorage()

  resolveAccessToken('delivery-a', '#token=sender-token&role=sender', storage)
  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: 'sender-token', role: 'sender', fromFragment: false })

  resolveAccessToken('delivery-a', '#token=recipient-token', storage)
  assert.deepEqual(resolveAccessToken('delivery-a', '', storage), { token: 'recipient-token', role: 'recipient', fromFragment: false })
  assert.equal(storage.getItem(tokenStorageKey('delivery-a', 'sender')), 'sender-token')
  assert.equal(storage.getItem(tokenStorageKey('delivery-a', 'recipient')), 'recipient-token')
})

test('a new fragment replaces only the credential for its role', () => {
  const storage = new MemoryStorage()

  resolveAccessToken('delivery-a', '#token=sender-old&role=sender', storage)
  resolveAccessToken('delivery-a', '#token=sender-new&role=sender', storage)

  assert.equal(resolveAccessToken('delivery-a', '', storage).token, 'sender-new')
  assert.equal(storage.getItem(tokenStorageKey('delivery-a', 'recipient')), null)
})

test('removing an invalid sender credential also removes its active role', () => {
  const storage = new MemoryStorage()
  resolveAccessToken('delivery-a', '#token=expired&role=sender', storage)

  removeAccessToken('delivery-a', storage, 'sender')

  assert.equal(resolveAccessToken('delivery-a', '', storage).token, null)
  assert.equal(storage.getItem(activeRoleStorageKey('delivery-a')), null)
})
