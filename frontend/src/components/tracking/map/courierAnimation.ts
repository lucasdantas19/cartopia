import { progressRatioFromInstants } from '../../../utils/dateTime.ts'
import type { Coordinates } from '../../../domain/delivery/locations.ts'
import { interpolateCoordinates } from '../../../utils/geoPosition.ts'

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
  legs?: Array<{ origin: Coordinates; destination: Coordinates; startsAt: string; arrivesAt: string }>
}

export function createCourierAnimation({ marker, origin, destination, startsAt, arrivesAt, scheduler, legs = [] }: CourierAnimationOptions) {
  let frame: number | null = null

  function update() {
    const now = scheduler.now()
    const activeLeg = legs.find((leg) => now < Date.parse(leg.arrivesAt)) ?? legs.at(-1)
    const leg = activeLeg ?? { origin, destination, startsAt, arrivesAt }
    const progress = progressRatioFromInstants(leg.startsAt, leg.arrivesAt, now)
    marker.setLngLat(interpolateCoordinates(leg.origin, leg.destination, progress))

    if (!scheduler.prefersReducedMotion() && now < Date.parse(arrivesAt)) {
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
