import assert from 'node:assert/strict'
import test from 'node:test'
import { clampProgress, interpolateCoordinates } from '../src/geoPosition.ts'

const origin: [number, number] = [-34.877, -8.063]
const destination: [number, number] = [-34.912, -8.047]

test('places the courier at the origin, midpoint and destination', () => {
  assert.deepEqual(interpolateCoordinates(origin, destination, 0), origin)
  assert.deepEqual(interpolateCoordinates(origin, destination, 0.5), [-34.8945, -8.055])
  assert.deepEqual(interpolateCoordinates(origin, destination, 1), destination)
})

test('clamps progress outside the route bounds', () => {
  assert.equal(clampProgress(-1), 0)
  assert.deepEqual(interpolateCoordinates(origin, destination, -1), origin)
  assert.equal(clampProgress(2), 1)
  assert.deepEqual(interpolateCoordinates(origin, destination, 2), destination)
})
