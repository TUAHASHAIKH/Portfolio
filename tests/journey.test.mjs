import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

// Exercise the actual pure TypeScript controller without adding a test runner.
const source = await readFile(new URL('../components/polar/journey.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const journeyUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { crystalJourney, CRYSTAL_KINDS, crystalCenter, JOURNEY_END } = await import(journeyUrl)
const ringsSource = await readFile(new URL('../components/polar/ring-journey.ts', import.meta.url), 'utf8')
const ringsCode = ts.transpileModule(ringsSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace("'./journey'",JSON.stringify(journeyUrl))
const { ringJourney } = await import(`data:text/javascript;base64,${Buffer.from(ringsCode).toString('base64')}`)

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

test('adding the passage preserves the native scroll distance to every crystal', async () => {
  const css = await readFile(new URL('../app/globals.css',import.meta.url),'utf8')
  const trackHeight = Number(css.match(/\.journey-track\{height:(\d+)svh/)[1])
  assert.equal((trackHeight-100)/JOURNEY_END,220)
  for(const kind of CRYSTAL_KINDS) {
    assert.equal(crystalJourney(crystalCenter(kind))[`${kind}Interactive`],true)
  }
  const afterCrystals=crystalJourney(4)
  for(const kind of CRYSTAL_KINDS){
    assert.equal(afterCrystals[`${kind}Interactive`],false)
    assert.equal(afterCrystals[`${kind}Opacity`],0)
  }
})

test('the ring camera descends continuously through every portal in either direction', () => {
  let previous=ringJourney(3.25)
  for(let p=3.2501;p<=JOURNEY_END;p+=.0001){
    const next=ringJourney(p)
    for(const key of ['y','z','targetY','targetZ','roll','upright','fov','opacity','proximity','floor','core','coreGlow']) {
      assert(Number.isFinite(next[key]),`${key} must stay finite`)
      assert(Math.abs(next[key]-previous[key])<.02,`${key} jumps at ${p}`)
    }
    assert(next.y<=previous.y+.001,'Descent must not reverse or snap between rings')
    previous=next
  }
  assert.equal(ringJourney(3).opacity,0)
  assert.equal(ringJourney(JOURNEY_END).coreGlow,0)
  assert(ringJourney(JOURNEY_END).floor>.6,'The final disc must be revealed')
})
