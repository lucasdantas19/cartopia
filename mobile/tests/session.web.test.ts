import assert from 'node:assert/strict'
import test from 'node:test'
import { clearSession, readSession, saveSession } from '../src/session.web.ts'

test('stores, restores, and clears the browser session', async (t) => {
  const values = new Map<string, string>()
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  })
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow)
    else Reflect.deleteProperty(globalThis, 'window')
  })

  const session = {
    token: 'test-token',
    user: { id: 1, name: 'Ana', email: 'ana@example.com' },
  }

  await saveSession(session)
  assert.deepEqual(await readSession(), session)

  await clearSession()
  assert.equal(await readSession(), null)

  values.set('cartopia.session', '{invalid')
  assert.equal(await readSession(), null)
  assert.equal(values.size, 0)
})
