import { progressRatioFromInstants } from './dateTime.ts'
import type { Coordinates } from './locations.ts'
import { interpolateCoordinates } from './geoPosition.ts'

export interface PositionMarker {
  setLngLat(coordinates: Coordinates): PositionMarker
}

export interface AnimationScheduler {
  requestFrame(callback: () => void): number
  cancelFrame(frame: number): void
  now(): number
  prefersReducedMotion(): boolean
}

export interface CourierAnimationOptions {
  marker: PositionMarker
  origin: Coordinates
  destination: Coordinates
  startsAt: string
  arrivesAt: string
  scheduler: AnimationScheduler
}

export function createCourierAnimation({ marker, origin, destination, startsAt, arrivesAt, scheduler }: CourierAnimationOptions) {
  let frame: number | null = null

  function update() {
    const progress = progressRatioFromInstants(startsAt, arrivesAt, scheduler.now())
    marker.setLngLat(interpolateCoordinates(origin, destination, progress))

    if (!scheduler.prefersReducedMotion() && progress < 1) {
      frame = scheduler.requestFrame(update)
    } else {
      frame = null
    }
  }

  return {
    start() {
      if (frame !== null) scheduler.cancelFrame(frame)
      update()
    },
    stop() {
      if (frame !== null) {
        scheduler.cancelFrame(frame)
        frame = null
      }
    },
  }
}
