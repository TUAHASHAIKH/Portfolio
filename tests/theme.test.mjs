import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

// Exercise the actual head script: a preference must be applied before paint,
// including when storage is unavailable. Browser media preferences are absent
// here so accidental reliance on them also fails these checks.
const layout = await readFile(new URL('../app/layout.tsx', import.meta.url), 'utf8')
const script = layout.match(/__html: `([\s\S]*?)`/)[1]
for (const [label, stored, expected] of [
  ['fresh device', null, 'light'],
  ['invalid saved value', 'automatic', 'light'],
  ['saved daylight', 'light', 'light'],
  ['saved nightfall', 'dark', 'dark'],
  ['blocked storage', new Error('Storage disabled'), 'light'],
]) {
  test(`initial theme: ${label}`, () => {
    const document = { documentElement: { dataset: {} } }
    vm.runInNewContext(script, {
      document,
      localStorage: { getItem() { if (stored instanceof Error) throw stored; return stored } },
      history: {},
      window: { scrollTo() {}, addEventListener() {} },
    })
    assert.equal(document.documentElement.dataset.theme, expected)
  })
}
