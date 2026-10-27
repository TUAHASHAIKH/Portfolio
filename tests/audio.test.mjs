import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const modules = new Map()
async function load(name) {
  if (modules.has(name)) return modules.get(name)
  const source = await readFile(new URL(`../components/polar/${name}.ts`, import.meta.url), 'utf8')
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  for (const match of [...code.matchAll(/from '\.\/([^']+)'/g)]) code = code.replace(match[0], `from '${await load(match[1])}'`)
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  modules.set(name, url)
  return url
}
const { AUDIO_TRACKS } = await import(await load('audio-manifest'))
const { audioMix } = await import(await load('audio-mix'))
const { PortfolioAudio } = await import(await load('audio-engine'))
const { glitchEnvelope } = await import(await load('glitch-motion'))

test('the complete reference manifest points to local Ogg files', async () => {
  assert.equal(Object.keys(AUDIO_TRACKS).length, 18)
  for (const track of Object.values(AUDIO_TRACKS)) {
    const bytes = await readFile(new URL(`../public/audio/${track.file}.ogg`, import.meta.url))
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS')
  }
})

test('scene audio stays bounded, reversible, and continuous at the loop seam', () => {
  for (let progress = 0; progress <= 10; progress += .01) {
    for (const level of Object.values(audioMix(progress, 10, 10, 10))) assert(level >= 0 && level <= 1)
  }
  assert.deepEqual(audioMix(0), audioMix(10))
  assert.equal(audioMix(2, 1).wind, 0)
  assert.equal(audioMix(2, 1).shard, .5)
  assert.equal(audioMix(7.5, 1, 1).shard, 0)
  assert.equal(audioMix(7.5, 1, 1).particles, .25)
  assert.equal(audioMix(0, 1, 1).portals, 0)
})

test('detail glitch bursts start and finish quietly and cannot remain active', () => {
  for (const duration of [.9, .95]) {
    assert.equal(glitchEnvelope(-1, duration), 0)
    assert.equal(glitchEnvelope(0, duration), 0)
    assert.equal(glitchEnvelope(duration, duration), 0)
    assert.equal(glitchEnvelope(Infinity, duration), 0)
    for (let t = .001; t < duration; t += .001) {
      assert(glitchEnvelope(t, duration) <= .65)
      assert(Math.abs(glitchEnvelope(t, duration) - glitchEnvelope(duration - t, duration)) < 1e-10)
    }
  }
})

test('audio is opt-in, reuses loops, throttles beeps, mutes cues, and retries missing files', async () => {
  const originalFetch = globalThis.fetch, originalContext = globalThis.AudioContext, originalDocument = globalThis.document
  const contexts = [], requests = []
  let fail = true
  class FakeContext {
    currentTime = 1
    state = 'suspended'
    destination = {}
    sources = []
    constructor() { contexts.push(this) }
    createGain() { return { gain: { value: 0, setTargetAtTime(value) { this.value = value } }, connect() {}, disconnect() {} } }
    createBufferSource() {
      const source = { loop: false, connect() {}, disconnect() {}, start() { this.started = true }, stop() { this.stopped = true } }
      this.sources.push(source); return source
    }
    async resume() { this.state = 'running' }
    async suspend() { this.state = 'suspended' }
    async close() { this.state = 'closed' }
    async decodeAudioData() { return {} }
  }
  globalThis.AudioContext = FakeContext
  globalThis.document = { hidden: false }
  globalThis.fetch = async url => { requests.push(url); return { ok: !(fail && url.endsWith('logo.ogg')), status: 404, arrayBuffer: async () => new ArrayBuffer(8) } }
  const audio = new PortfolioAudio()
  try {
    audio.cue('logo'); audio.update(2, 1 / 60)
    assert.equal(contexts.length, 0); assert.equal(requests.length, 0)
    await audio.toggle()
    assert.equal(audio.snapshot().failed, true)
    const context = contexts[0]
    assert.equal(context.sources.filter(source => source.loop).length, 7)
    const count = context.sources.length
    audio.cue('beeps'); audio.cue('beeps2')
    assert.equal(context.sources.length, count + 1, 'All beep variants share one cooldown')
    audio.detail(true)
    await audio.toggle()
    const muted = context.sources.length
    audio.cue('long')
    await new Promise(resolve => setTimeout(resolve, 800))
    assert.equal(context.sources.length, muted, 'Mute cancels delayed detail cues')
    fail = false
    await audio.toggle()
    assert.equal(audio.snapshot().failed, false)
    assert.equal(requests.length, 19, 'Retry fetches only the missing recording')
    assert.equal(context.sources.filter(source => source.loop).length, 7)
    document.hidden = true; audio.visibility(); await Promise.resolve()
    assert.equal(context.state, 'suspended')
    audio.dispose()
    assert.equal(context.state, 'closed')
    assert(context.sources.every(source => source.stopped))
  } finally {
    audio.dispose()
    globalThis.fetch = originalFetch; globalThis.AudioContext = originalContext; globalThis.document = originalDocument
  }
})
