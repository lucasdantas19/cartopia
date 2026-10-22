import assert from 'node:assert/strict'
import test from 'node:test'
import { couriers, getCourier } from '../src/couriers.ts'

test('lists all supported couriers with assets', () => {
  assert.deepEqual(couriers.map((courier) => courier.code), ['paper-swallow', 'postal-cat', 'little-dragon'])
  for (const courier of couriers) {
    assert.match(courier.cardAsset, /^\/couriers\/.*-card\.png$/)
    assert.match(courier.iconAsset, /^\/couriers\/.*-icon\.png$/)
  }
})

test('falls back to the paper swallow for unknown courier codes', () => {
  assert.equal(getCourier('unknown-courier').code, 'paper-swallow')
})
