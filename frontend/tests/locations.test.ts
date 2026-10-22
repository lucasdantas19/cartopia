import assert from 'node:assert/strict'
import test from 'node:test'
import { getLocation, locations } from '../src/locations.ts'

test('all supported delivery locations have coordinates', () => {
  assert.deepEqual(locations.map((location) => location.code), [
    'port-of-dreams',
    'garden-of-ideas',
    'library-of-memories',
  ])

  for (const location of locations) {
    assert.equal(location.coordinates.length, 2)
    assert.ok(location.coordinates.every(Number.isFinite))
  }
})

test('unknown location codes do not produce map locations', () => {
  assert.equal(getLocation('unknown-place'), undefined)
})
