import type { Delivery, DeliveryStatus } from './types'

export function instant(value: string): number {
  const timestamp = Date.parse(value)

  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ISO 8601 instant: ${value}`)
  }

  return timestamp
}

export function statusFromTime(delivery: Delivery, now: number): DeliveryStatus {
  const startsAt = instant(delivery.starts_at)
  const arrivesAt = instant(delivery.arrives_at)

  if (now < startsAt) return 'SCHEDULED'
  if (now >= arrivesAt) return 'DELIVERED'

  return 'IN_TRANSIT'
}

export function progressFromTime(delivery: Delivery, now: number): number {
  const startsAt = instant(delivery.starts_at)
  const arrivesAt = instant(delivery.arrives_at)

  if (now <= startsAt) return 0
  if (now >= arrivesAt) return 100

  return Math.round(((now - startsAt) / (arrivesAt - startsAt)) * 100)
}

export function formatLocalDate(value: string, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(instant(value)))
}

export function formatRemaining(value: string, now: number): string {
  const remainingMinutes = Math.max(0, Math.ceil((instant(value) - now) / 60000))

  if (remainingMinutes === 0) return 'A entrega chegou.'
  if (remainingMinutes < 60) return `Chega em ${remainingMinutes} min.`

  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60

  return minutes ? `Chega em ${hours}h ${minutes}min.` : `Chega em ${hours}h.`
}
