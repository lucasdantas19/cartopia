import assert from 'node:assert/strict'
import test from 'node:test'
import { createCourierAnimation } from '../src/courierAnimation.ts'
import type { Coordinates } from '../src/locations.ts'

const origin: Coordinates = [-34.877, -8.063]
const destination: Coordinates = [-34.912, -8.047]

function setup(now: number, reducedMotion = false) {
  let nextFrame = 0
  let scheduled: (() => void) | null = null
  const cancelled: number[] = []
  const positions: Coordinates[] = []
  const marker = { setLngLat: (coordinates: Coordinates) => { positions.push(coordinates); return marker } }
  const scheduler = {
    requestFrame: (callback: () => void) => { scheduled = callback; return ++nextFrame },
    cancelFrame: (frame: number) => { cancelled.push(frame) },
    now: () => now,
    prefersReducedMotion: () => reducedMotion,
  }

  return { animation: createCourierAnimation({ marker, origin, destination, startsAt: '2026-10-21T15:00:00Z', arrivesAt: '2026-10-21T15:05:00Z', scheduler }), cancelled, positions, get scheduled() { return scheduled } }
}

test('updates immediately after reload and schedules animation while in transit', () => {
  const state = setup(Date.parse('2026-10-21T15:02:30Z'))

  state.animation.start()

  assert.deepEqual(state.positions[0], [-34.8945, -8.055])
  assert.ok(state.scheduled)
})

test('cancels the pending frame when animation stops', () => {
  const state = setup(Date.parse('2026-10-21T15:02:30Z'))
  state.animation.start()

  state.animation.stop()

  assert.deepEqual(state.cancelled, [1])
})

test('uses a static position when reduced motion is preferred', () => {
  const state = setup(Date.parse('2026-10-21T15:02:30Z'), true)
  state.animation.start()

  assert.equal(state.scheduled, null)
  assert.deepEqual(state.positions[0], [-34.8945, -8.055])
})
