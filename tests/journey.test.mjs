import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual pure TypeScript controller without adding a test runner.
const source = await readFile(new URL('../components/polar/journey.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const { crystalJourney, CRYSTAL_KINDS, crystalCenter } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('equal scroll gestures move every crystal equally through its center', () => {
  for (const direction of [-1, 1]) {
    for (let offset = -.3; offset <= .3; offset += .01) {
      const movements = CRYSTAL_KINDS.map(kind => {
        const start = crystalCenter(kind) + offset
        return crystalJourney(start + direction*.01)[`${kind}Y`] - crystalJourney(start)[`${kind}Y`]
      })
      assert(movements.every(distance => Math.sign(distance) === direction), 'Scrolling must keep moving every crystal')
      for (const distance of movements) {
        assert(Math.abs(distance - movements[1]) < 1e-10, `A crystal slows independently near offset ${offset}`)
      }
    }
  }
})

test('hover centering destinations still match all three resting poses', () => {
  for (const kind of CRYSTAL_KINDS) {
    assert.equal(crystalJourney(crystalCenter(kind))[`${kind}Y`], 0)
  }
})
