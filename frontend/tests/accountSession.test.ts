import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldExpireAccountSession } from '../src/services/accountSession.ts'

test('redirects when the current account session is rejected', () => {
  assert.equal(shouldExpireAccountSession(401, '/auth/me', 'old-token', 'old-token'), true)
  assert.equal(shouldExpireAccountSession(401, '/account/deliveries', 'old-token', 'old-token'), true)
})

test('keeps the session on temporary failures and responses for a previous login', () => {
  assert.equal(shouldExpireAccountSession(500, '/account/deliveries', 'token', 'token'), false)
  assert.equal(shouldExpireAccountSession(401, '/account/deliveries', 'old-token', 'new-token'), false)
  assert.equal(shouldExpireAccountSession(401, '/auth/login', 'token', 'token'), false)
  assert.equal(shouldExpireAccountSession(401, '/deliveries/abc', 'token', 'token'), false)
})
