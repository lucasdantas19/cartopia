import assert from 'node:assert/strict'
import test from 'node:test'
import { deliveryProgressPercent, deliveryStatusLabel } from '../src/trackingDisplay.ts'

test('uses the percentage already returned by the API and keeps it within range', () => {
  assert.equal(deliveryProgressPercent(37), 37)
  assert.equal(deliveryProgressPercent(100), 100)
  assert.equal(deliveryProgressPercent(-5), 0)
  assert.equal(deliveryProgressPercent(140), 100)
})

test('distinguishes departure, travel, and arrival', () => {
  assert.equal(deliveryStatusLabel('SCHEDULED'), 'Preparando a partida')
  assert.equal(deliveryStatusLabel('IN_TRANSIT'), 'A caminho')
  assert.equal(deliveryStatusLabel('DELIVERED'), 'Chegou ao destino')
})
