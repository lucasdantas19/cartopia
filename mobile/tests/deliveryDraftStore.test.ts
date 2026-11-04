import assert from 'node:assert/strict'
import test from 'node:test'
import { createDraftStore, parseDraft, type DeliveryDraft } from '../src/deliveryDraftStore.ts'

const draft: DeliveryDraft = {
  senderName: '', recipientName: 'Ana', recipientEmail: '', message: 'Uma carta 💌',
  originLocation: null, destinationLocation: null, courier: 'paper-swallow', duration: '30', stage: 0,
}

function setup() {
  const values = new Map<string, string>()
  let fail = false
  const store = createDraftStore({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      assert.ok(Buffer.byteLength(value) <= 2048)
      if (fail) throw new Error('Storage unavailable')
      values.set(key, value)
    },
    deleteItem: async (key) => { values.delete(key) },
  })
  return { store, values, failWrites: () => { fail = true } }
}

test('recovers a long Unicode draft across store reads and clears its contents', async () => {
  const { store, values } = setup()
  const long = { ...draft, message: '💌'.repeat(5000), stage: 2 }
  await store.save(long)
  assert.deepEqual(await store.read(), long)
  await store.clear()
  assert.equal(await store.read(), null)
  assert.equal(values.size, 0)
})

test('a failed save preserves the previously completed draft', async () => {
  const { store, failWrites } = setup()
  await store.save(draft)
  failWrites()
  await assert.rejects(store.save({ ...draft, message: 'Changed' }))
  assert.deepEqual(await store.read(), draft)
})

test('queued saves finish before a discard and do not resurrect a draft', async () => {
  const { store } = setup()
  await Promise.all([store.save(draft), store.save({ ...draft, stage: 1 }), store.clear()])
  assert.equal(await store.read(), null)
})

test('invalid, incomplete and unsupported drafts are ignored', async () => {
  for (const value of ['null', '{', '{}', JSON.stringify({ ...draft, stage: 9 }), JSON.stringify({ ...draft, originLocation: { label: 'X', latitude: 100, longitude: 0 } })]) {
    assert.equal(parseDraft(value), null)
  }
  const { store, values } = setup()
  await store.save(draft)
  values.delete('cartopia.delivery-draft.v1.a.0')
  assert.equal(await store.read(), null)
})
