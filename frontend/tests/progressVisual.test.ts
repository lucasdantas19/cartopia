import assert from 'node:assert/strict'
import test from 'node:test'
import { progressMarkerTransform } from '../src/progressVisual.ts'

test('keeps the mascot inside the progress bar at its boundaries', () => {
  assert.equal(progressMarkerTransform(0), 'translateX(0)')
  assert.equal(progressMarkerTransform(50), 'translateX(-50%)')
  assert.equal(progressMarkerTransform(100), 'translateX(-100%)')
})
