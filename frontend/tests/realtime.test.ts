import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveryChannelName, realtimeConfiguration } from '../src/realtime.ts'

test('configures Reverb from the frontend environment without exposing the secret', () => {
  const configuration = realtimeConfiguration({
    VITE_REVERB_APP_KEY: 'public-key',
    VITE_REVERB_HOST: '127.0.0.1',
    VITE_REVERB_PORT: '8080',
    VITE_REVERB_SCHEME: 'http',
    VITE_API_URL: 'http://localhost:8000/api',
  })

  assert.deepEqual(configuration, {
    key: 'public-key',
    host: '127.0.0.1',
    port: 8080,
    scheme: 'http',
    authEndpoint: 'http://localhost:8000/api/broadcasting/auth',
  })
  assert.equal('secret' in (configuration ?? {}), false)
})

test('disables the optional connection when explicitly disabled', () => {
  assert.equal(realtimeConfiguration({ VITE_REVERB_ENABLED: 'false', VITE_REVERB_APP_KEY: 'public-key' }), null)
})

test('keeps the delivery identifier separate from the access token', () => {
  assert.equal(deliveryChannelName('delivery-uuid'), 'deliveries.delivery-uuid')
})
