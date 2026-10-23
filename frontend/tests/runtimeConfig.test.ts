import assert from 'node:assert/strict'
import test from 'node:test'
import { FrontendConfigurationError, resolveApiBaseUrl } from '../src/runtimeConfig.ts'

test('keeps the localhost API fallback for development', () => {
  assert.equal(resolveApiBaseUrl({}), 'http://localhost:8000/api')
})

test('rejects a production build without an API URL', () => {
  assert.throws(
    () => resolveApiBaseUrl({ PROD: true }),
    (error: unknown) => error instanceof FrontendConfigurationError && error.message.includes('VITE_API_URL'),
  )
})

test('rejects localhost and non-HTTPS API URLs in production', () => {
  assert.throws(() => resolveApiBaseUrl({ PROD: true, VITE_API_URL: 'http://localhost:8000/api' }), FrontendConfigurationError)
  assert.throws(() => resolveApiBaseUrl({ PROD: true, VITE_API_URL: 'http://api.example.com/api' }), FrontendConfigurationError)
})

test('accepts a public HTTPS API URL in production', () => {
  assert.equal(resolveApiBaseUrl({ PROD: true, VITE_API_URL: 'https://api.example.com/api/' }), 'https://api.example.com/api')
})
