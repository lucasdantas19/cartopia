import assert from 'node:assert/strict'
import test from 'node:test'
import { isPasswordStrongEnough } from '../src/passwordRequirements.ts'

test('validates all account password requirements', () => {
  assert.equal(isPasswordStrongEnough('Password123'), true)
  assert.equal(isPasswordStrongEnough('password123'), false)
  assert.equal(isPasswordStrongEnough('PASSWORD123'), false)
  assert.equal(isPasswordStrongEnough('Password'), false)
})
