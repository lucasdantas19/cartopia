import assert from 'node:assert/strict'
import test from 'node:test'
import { copyText } from '../src/clipboard.ts'

test('reports successful clipboard writes', async () => {
  let value = ''

  const copied = await copyText('https://cartopia.example/delivery#token=secret', {
    writeText: async (nextValue) => { value = nextValue },
  })

  assert.equal(copied, true)
  assert.equal(value, 'https://cartopia.example/delivery#token=secret')
})

test('reports clipboard failures without throwing', async () => {
  const copied = await copyText('https://cartopia.example/delivery#token=secret', {
    writeText: async () => { throw new Error('clipboard unavailable') },
  })

  assert.equal(copied, false)
  assert.equal(await copyText('link', null), false)
})
