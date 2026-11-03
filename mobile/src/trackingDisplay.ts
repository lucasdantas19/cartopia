import type { Delivery } from './domain'

export function deliveryProgressPercent(progress: number) {
  if (!Number.isFinite(progress)) return 0
  return Math.max(0, Math.min(100, Math.round(progress)))
}

export function deliveryStatusLabel(status: Delivery['status']) {
  return {
    SCHEDULED: 'Preparando a partida',
    IN_TRANSIT: 'A caminho',
    DELIVERED: 'Chegou ao destino',
  }[status]
}

export function arrivalLabel(arrivesAt: string | null) {
  if (!arrivesAt) return null

  const date = new Date(arrivesAt)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
