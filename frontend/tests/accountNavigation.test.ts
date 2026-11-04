import assert from 'node:assert/strict'
import test from 'node:test'
import { accountSections, accountSectionFromPath } from '../src/utils/accountNavigation.ts'

test('every account destination resolves directly and with a trailing slash', () => {
  for (const section of accountSections) {
    assert.equal(accountSectionFromPath(section.path), section.id)
    assert.equal(accountSectionFromPath(`${section.path}/`), section.id)
  }
})

test('unrelated paths do not resolve to an account section', () => {
  for (const path of ['/', '/contabilidade', '/conta/desconhecida', '/conta/cartas/123']) {
    assert.equal(accountSectionFromPath(path), null)
  }
  assert.equal(new Set(accountSections.map((item) => item.path)).size, accountSections.length)
})
