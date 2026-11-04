import type { ActiveMapDelivery } from '../../services/api'

export const activeMapColors = ['#7655b4', '#c05445', '#087e74', '#b26a00', '#2163b5']

export function activeMapRoute(delivery: ActiveMapDelivery) {
  const origin = delivery.origin_location
  const destination = delivery.destination_location
  if (!origin || !destination) return null
  const valid = (point: typeof origin) => Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
  if (!valid(origin) || !valid(destination)) return null
  if (origin.latitude === destination.latitude && origin.longitude === destination.longitude) return null
  return {
    origin: [origin.longitude, origin.latitude] as [number, number],
    destination: [destination.longitude, destination.latitude] as [number, number],
  }
}

export function activeMapPosition(delivery: ActiveMapDelivery, now: number) {
  const route = activeMapRoute(delivery)
  if (!route) return null
  const startsAt = Date.parse(delivery.starts_at)
  const arrivesAt = Date.parse(delivery.arrives_at)
  const progress = Number.isFinite(startsAt) && Number.isFinite(arrivesAt) && arrivesAt > startsAt
    ? Math.max(0, Math.min(1, (now - startsAt) / (arrivesAt - startsAt)))
    : Math.max(0, Math.min(1, delivery.progress / 100))
  return [
    route.origin[0] + (route.destination[0] - route.origin[0]) * progress,
    route.origin[1] + (route.destination[1] - route.origin[1]) * progress,
  ] as [number, number]
}
