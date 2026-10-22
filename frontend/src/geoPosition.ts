import type { Coordinates } from './locations'

export function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress))
}

export function interpolateCoordinates(origin: Coordinates, destination: Coordinates, progress: number): Coordinates {
  const ratio = clampProgress(progress)

  return [
    origin[0] + (destination[0] - origin[0]) * ratio,
    origin[1] + (destination[1] - origin[1]) * ratio,
  ]
}
