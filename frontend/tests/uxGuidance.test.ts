import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldShowFirstUseGuide } from '../src/utils/firstUseGuide.ts'
import { toggleFormSection, type FormSectionState } from '../src/utils/formSections.ts'
import { shouldFitRoute } from '../src/components/tracking/map/mapViewport.ts'

test('shows the first-use guide until it is explicitly dismissed', () => {
  assert.equal(shouldShowFirstUseGuide(null), true)
  assert.equal(shouldShowFirstUseGuide('false'), true)
  assert.equal(shouldShowFirstUseGuide('true'), false)
})

test('toggles one form section without changing the others', () => {
  const state: FormSectionState = { message: true, courier: false, adventure: true }
  assert.deepEqual(toggleFormSection(state, 'courier'), { message: true, courier: true, adventure: true })
  assert.deepEqual(toggleFormSection(state, 'message'), { message: false, courier: false, adventure: true })
})

test('does not refit a map after it has been fitted unless requested', () => {
  assert.equal(shouldFitRoute(false), true)
  assert.equal(shouldFitRoute(true), false)
  assert.equal(shouldFitRoute(true, true), true)
})
