import type { DeliveryLocation } from './domain'

export type DeliveryDraft = {
  senderName: string
  recipientName: string
  recipientEmail: string
  message: string
  originLocation: DeliveryLocation | null
  destinationLocation: DeliveryLocation | null
  courier: string
  duration: string
  stage: number
}

export interface DraftStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  deleteItem(key: string): Promise<void>
}

const key = 'cartopia.delivery-draft.v1'
const maxChunks = 100

function validLocation(value: unknown): boolean {
  if (value === null) return true
  if (!value || typeof value !== 'object') return false
  const location = value as DeliveryLocation
  return typeof location.label === 'string' && location.label.length <= 160
    && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180
}

export function parseDraft(value: string): DeliveryDraft | null {
  try {
    const draft = JSON.parse(value) as DeliveryDraft
    if (!draft || typeof draft !== 'object') return null
    for (const [field, limit] of Object.entries({ senderName: 120, recipientName: 120, recipientEmail: 255, message: 10000, duration: 4 })) {
      const text = draft[field as keyof DeliveryDraft]
      if (typeof text !== 'string' || text.length > limit) return null
    }
    if (!['paper-swallow', 'postal-cat', 'little-dragon'].includes(draft.courier)
      || ![0, 1, 2].includes(draft.stage)
      || !validLocation(draft.originLocation) || !validLocation(draft.destinationLocation)) return null
    return draft
  } catch {
    return null
  }
}

// Serialize writes and switch banks only after all chunks have been persisted.
// Small chunks also accommodate Unicode within SecureStore's per-value limits.
export function createDraftStore(storage: DraftStorage) {
  let pending: Promise<unknown> = Promise.resolve()
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation, operation)
    pending = result.catch(() => undefined)
    return result
  }
  return {
    read: () => enqueue(async () => {
      const manifest = await storage.getItem(key)
      if (!manifest) return null
      const [bank, countText] = manifest.split(':')
      const count = Number(countText)
      if (!['a', 'b'].includes(bank) || !Number.isInteger(count) || count < 1 || count > maxChunks) return null
      const chunks = await Promise.all(Array.from({ length: count }, (_, index) => storage.getItem(`${key}.${bank}.${index}`)))
      return chunks.some((chunk) => chunk === null) ? null : parseDraft(chunks.join(''))
    }),
    save: (draft: DeliveryDraft) => enqueue(async () => {
      const serialized = JSON.stringify(draft)
      if (!parseDraft(serialized)) throw new Error('Invalid draft')
      const bank = (await storage.getItem(key))?.startsWith('a:') ? 'b' : 'a'
      const characters = Array.from(serialized)
      const count = Math.ceil(characters.length / 400)
      if (count > maxChunks) throw new Error('Draft too large')
      for (let index = 0; index < count; index++) {
        await storage.setItem(`${key}.${bank}.${index}`, characters.slice(index * 400, (index + 1) * 400).join(''))
      }
      await storage.setItem(key, `${bank}:${count}`)
    }),
    clear: () => enqueue(async () => {
      await storage.deleteItem(key)
      for (const bank of ['a', 'b']) {
        for (let index = 0; index < maxChunks; index++) await storage.deleteItem(`${key}.${bank}.${index}`)
      }
    }),
  }
}
