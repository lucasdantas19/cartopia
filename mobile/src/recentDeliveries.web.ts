import type { RecentDelivery } from './recentDeliveriesStore'

export async function listRecentDeliveries(): Promise<RecentDelivery[]> {
  return []
}

export async function saveRecentDelivery(_item: RecentDelivery): Promise<void> {}

export async function removeRecentDelivery(_publicId: string): Promise<void> {}
