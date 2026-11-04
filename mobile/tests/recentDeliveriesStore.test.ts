import assert from 'node:assert/strict'
import test from 'node:test'
import {
  listRecentDeliveries,
  removeRecentDelivery,
  saveRecentDelivery,
  type RecentDelivery,
  type RecentDeliveryStorage,
} from '../src/recentDeliveriesStore.ts'

function memoryStorage() {
  const values = new Map<string, string>()
  const storage: RecentDeliveryStorage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value) },
    deleteItem: async (key) => { values.delete(key) },
  }

  return { storage, values }
}

function delivery(number: number): RecentDelivery {
  return {
    publicId: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    accessToken: `sender-token-${number}`,
    role: 'sender',
    recipientName: `Pessoa ${number}`,
    origin: 'Recife',
    destination: 'Olinda',
    createdAt: '2026-11-03T12:00:00.000Z',
  }
}

test('keeps the five newest deliveries and their sender access after reopening storage', async () => {
  const { storage, values } = memoryStorage()

  for (let number = 1; number <= 6; number += 1) {
    await saveRecentDelivery(storage, delivery(number))
  }

  const recent = await listRecentDeliveries(storage)
  assert.deepEqual(recent.map((item) => item.publicId), [6, 5, 4, 3, 2].map((number) => delivery(number).publicId))
  assert.equal(recent[0].accessToken, 'sender-token-6')
  assert.equal(values.has(`cartopia.recent.${delivery(1).publicId}`), false)

  await saveRecentDelivery(storage, { ...delivery(3), recipientName: 'Nome atualizado' })
  const reordered = await listRecentDeliveries(storage)
  assert.equal(reordered.length, 5)
  assert.equal(reordered[0].recipientName, 'Nome atualizado')
  assert.equal(reordered.filter((item) => item.publicId === delivery(3).publicId).length, 1)
})

test('removes only the chosen delivery from the device', async () => {
  const { storage, values } = memoryStorage()
  await saveRecentDelivery(storage, delivery(1))
  await saveRecentDelivery(storage, delivery(2))

  await removeRecentDelivery(storage, delivery(1).publicId)

  assert.deepEqual(await listRecentDeliveries(storage), [delivery(2)])
  assert.equal(values.has(`cartopia.recent.${delivery(1).publicId}`), false)
})

test('keeps recipient links and reads sender links saved by previous versions', async () => {
  const { storage } = memoryStorage()
  const oldSender = delivery(1)
  await storage.setItem(`cartopia.recent.${oldSender.publicId}`, JSON.stringify({
    publicId: oldSender.publicId,
    senderToken: oldSender.accessToken,
    recipientName: oldSender.recipientName,
    origin: oldSender.origin,
    destination: oldSender.destination,
    createdAt: oldSender.createdAt,
  }))
  await storage.setItem('cartopia.recent.index', JSON.stringify([oldSender.publicId]))

  const recipient = {
    ...delivery(2),
    accessToken: 'recipient-token-2',
    role: 'recipient' as const,
  }
  await saveRecentDelivery(storage, recipient)

  assert.deepEqual(await listRecentDeliveries(storage), [recipient, oldSender])
  await removeRecentDelivery(storage, recipient.publicId)
  assert.deepEqual(await listRecentDeliveries(storage), [oldSender])
})
