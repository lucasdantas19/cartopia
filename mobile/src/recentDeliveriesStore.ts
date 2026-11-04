export type RecentDelivery = {
  publicId: string
  accessToken: string
  role: 'sender' | 'recipient'
  recipientName: string
  origin: string
  destination: string
  createdAt: string
}

export type RecentDeliveryStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  deleteItem: (key: string) => Promise<void>
}

const indexKey = 'cartopia.recent.index'
const itemKey = (publicId: string) => `cartopia.recent.${publicId}`
const maxRecentDeliveries = 5
const publicIdPattern = /^[0-9a-f-]{36}$/i

function parseIndex(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((id): id is string => (
      typeof id === 'string' && publicIdPattern.test(id)
    )).slice(0, maxRecentDeliveries)
  } catch {
    return []
  }
}

function parseDelivery(value: string | null): RecentDelivery | null {
  if (!value) return null

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return null

    const item = parsed as Record<string, unknown>
    if (
      typeof item.publicId !== 'string' || !publicIdPattern.test(item.publicId) ||
      typeof item.recipientName !== 'string' ||
      typeof item.origin !== 'string' ||
      typeof item.destination !== 'string' ||
      typeof item.createdAt !== 'string'
    ) return null

    const accessToken = typeof item.accessToken === 'string'
      ? item.accessToken
      : item.senderToken
    const role = item.role ?? 'sender'
    if (typeof accessToken !== 'string' || !accessToken) return null
    if (role !== 'sender' && role !== 'recipient') return null

    return {
      publicId: item.publicId,
      accessToken,
      role,
      recipientName: item.recipientName,
      origin: item.origin,
      destination: item.destination,
      createdAt: item.createdAt,
    } as RecentDelivery
  } catch {
    return null
  }
}

export async function listRecentDeliveries(storage: RecentDeliveryStorage): Promise<RecentDelivery[]> {
  const ids = parseIndex(await storage.getItem(indexKey))
  const items = await Promise.all(ids.map((id) => storage.getItem(itemKey(id))))

  return items.flatMap((value, index) => {
    const item = parseDelivery(value)
    return item?.publicId === ids[index] ? [item] : []
  })
}

export async function saveRecentDelivery(storage: RecentDeliveryStorage, item: RecentDelivery) {
  if (!publicIdPattern.test(item.publicId)) throw new Error('Invalid delivery ID')
  if (!item.accessToken || !['sender', 'recipient'].includes(item.role)) {
    throw new Error('Invalid delivery access')
  }

  const previous = await listRecentDeliveries(storage)
  const next = [item, ...previous.filter((entry) => entry.publicId !== item.publicId)]
  const kept = next.slice(0, maxRecentDeliveries)
  const removed = next.slice(maxRecentDeliveries)

  await storage.setItem(itemKey(item.publicId), JSON.stringify(item))
  await storage.setItem(indexKey, JSON.stringify(kept.map((entry) => entry.publicId)))
  await Promise.all(removed.map((entry) => storage.deleteItem(itemKey(entry.publicId))))
}

export async function removeRecentDelivery(storage: RecentDeliveryStorage, publicId: string) {
  if (!publicIdPattern.test(publicId)) return

  const remaining = (await listRecentDeliveries(storage))
    .filter((entry) => entry.publicId !== publicId)

  await storage.deleteItem(itemKey(publicId))
  await storage.setItem(indexKey, JSON.stringify(remaining.map((entry) => entry.publicId)))
}
