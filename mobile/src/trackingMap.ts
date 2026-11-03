import type { Delivery, DeliveryLocation } from './domain'

export type MapPoint = { latitude: number; longitude: number }

function validPoint(location: DeliveryLocation | null | undefined): location is DeliveryLocation {
  return Boolean(
    location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180,
  )
}

export function deliveryMapRoute(delivery: Delivery): { origin: MapPoint; destination: MapPoint } | null {
  const origin = delivery.origin_location
  const destination = delivery.destination_location
  if (!validPoint(origin) || !validPoint(destination)) return null
  if (origin.latitude === destination.latitude && origin.longitude === destination.longitude) return null

  return {
    origin: { latitude: origin.latitude, longitude: origin.longitude },
    destination: { latitude: destination.latitude, longitude: destination.longitude },
  }
}

export function estimatedMapProgress(delivery: Delivery, fetchedAt: number, now: number) {
  if (delivery.status === 'DELIVERED') return 100
  if (delivery.status === 'SCHEDULED') return 0

  const base = Number.isFinite(delivery.progress)
    ? Math.max(0, Math.min(100, delivery.progress))
    : 0
  const startsAt = Date.parse(delivery.starts_at ?? '')
  const arrivesAt = Date.parse(delivery.arrives_at ?? '')
  const duration = arrivesAt - startsAt
  if (!Number.isFinite(duration) || duration <= 0) return base

  const elapsedSinceFetch = Math.max(0, now - fetchedAt)
  return Math.min(100, base + elapsedSinceFetch / duration * 100)
}

export function pointAlongRoute(origin: MapPoint, destination: MapPoint, progress: number): MapPoint {
  const fraction = Math.max(0, Math.min(1, progress / 100))

  return {
    latitude: origin.latitude + (destination.latitude - origin.latitude) * fraction,
    longitude: origin.longitude + (destination.longitude - origin.longitude) * fraction,
  }
}
