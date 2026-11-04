import type { ActiveMapDelivery } from '../domain'

export const deliveryColors = ['#7c3aed', '#d34841', '#087e74', '#ba6800', '#2163b5']

export function SimultaneousDeliveryMap(_props: {
  deliveries: ActiveMapDelivery[]
  fetchedAt: number
  selectedId: string | null
  onSelect: (publicId: string | null) => void
}) {
  return null
}
