import assert from 'node:assert/strict'
import test from 'node:test'
import { getMapPadding, getRouteBounds, hasMapDimensions } from '../src/mapViewport.ts'

test('calculates bounds for nearby points in longitude-latitude order', () => {
  assert.deepEqual(getRouteBounds([-34.877, -8.063], [-34.912, -8.047]), [
    [-34.912, -8.063],
    [-34.877, -8.047],
  ])
})

test('calculates bounds for distant points without changing coordinates', () => {
  assert.deepEqual(getRouteBounds([-73.985, 40.748], [151.209, -33.868]), [
    [-73.985, -33.868],
    [151.209, 40.748],
  ])
})

test('uses responsive padding for desktop and mobile dimensions', () => {
  assert.equal(getMapPadding(1200, 560), 67)
  assert.equal(getMapPadding(360, 288), 35)
  assert.equal(getMapPadding(100, 100), 24)
})

test('only fits after the map container has dimensions', () => {
  assert.equal(hasMapDimensions(0, 288), false)
  assert.equal(hasMapDimensions(360, 0), false)
  assert.equal(hasMapDimensions(360, 288), true)
})
