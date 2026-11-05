import assert from 'node:assert/strict'
import test from 'node:test'
import { isPasswordStrongEnough, passwordRequirements } from '../src/utils/passwordRequirements.ts'

test('validates all account password requirements', () => {
  assert.equal(isPasswordStrongEnough('Password123'), true)
  assert.equal(isPasswordStrongEnough('password123'), false)
  assert.equal(isPasswordStrongEnough('PASSWORD123'), false)
  assert.equal(isPasswordStrongEnough('Password'), false)
  assert.equal(passwordRequirements('Password123').every((requirement) => requirement.valid), true)
})
