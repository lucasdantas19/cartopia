import type { Coordinates } from './locations'

export type RouteBounds = [Coordinates, Coordinates]

export function getRouteBounds(origin: Coordinates, destination: Coordinates): RouteBounds {
  return [
    [Math.min(origin[0], destination[0]), Math.min(origin[1], destination[1])],
    [Math.max(origin[0], destination[0]), Math.max(origin[1], destination[1])],
  ]
}

export function getMapPadding(width: number, height: number): number {
  const shortestSide = Math.min(width, height)

  return Math.round(Math.max(24, Math.min(72, shortestSide * 0.12)))
}

export function hasMapDimensions(width: number, height: number): boolean {
  return width > 0 && height > 0
}
