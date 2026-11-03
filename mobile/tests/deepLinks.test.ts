import assert from 'node:assert/strict'
import test from 'node:test'
import { createDeliveryShareUrl, deliveryPath, parseDeliveryLink } from '../src/deepLinks.ts'

test('parses recipient delivery links', () => {
  assert.deepEqual(parseDeliveryLink('https://cartopia.test/d/abc-123#token=secret'), {
    publicId: 'abc-123',
    token: 'secret',
    role: 'recipient',
  })
})

test('parses sender role and preserves encoded values', () => {
  const path = deliveryPath('abc/123', 'token value', 'sender')
  assert.deepEqual(parseDeliveryLink(`https://cartopia.test${path}`), {
    publicId: 'abc/123',
    token: 'token value',
    role: 'sender',
  })
})

test('rejects links without an access token', () => {
  assert.equal(parseDeliveryLink('https://cartopia.test/d/abc-123'), null)
})

test('creates different web links for recipient and sender', () => {
  assert.equal(
    createDeliveryShareUrl('https://cartopia.test/', 'abc/123', 'recipient token', 'recipient'),
    'https://cartopia.test/d/abc%2F123#token=recipient%20token',
  )
  assert.equal(
    createDeliveryShareUrl('https://cartopia.test/', 'abc/123', 'sender token', 'sender'),
    'https://cartopia.test/d/abc%2F123#token=sender%20token&role=sender',
  )
  assert.equal(createDeliveryShareUrl('', 'abc', 'token', 'recipient'), null)
})
