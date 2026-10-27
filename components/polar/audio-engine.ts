import { AUDIO_TRACKS, type SoundName } from './audio-manifest'
import { audioMix } from './audio-mix'

type Track = { buffer: AudioBuffer; gain: GainNode; source?: AudioBufferSourceNode }
const initialState = { enabled: false, loading: false, failed: false }

export class PortfolioAudio {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private tracks = new Map<SoundName, Track>()
  private listeners = new Set<() => void>()
  private state = initialState
  private generation = 0
  private loading: Promise<void> | null = null
  private controller: AbortController | null = null
  private lastCue = new Map<string, number>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private progress = 0
  private pulse = { shard: 0, particles: 0, brand: 0 }
  private elapsed = 0

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.state
  serverSnapshot = () => initialState
  private publish(state: typeof initialState) { this.state = state; this.listeners.forEach(listener => listener()) }

  async toggle() {
    if (this.state.enabled) { this.mute(); return }
    const generation = this.generation
    try {
      // Construct and resume synchronously inside the user's click. Loading
      // buffers later must never require a second autoplay permission gesture.
      if (!this.context) {
        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = 0
        this.master.connect(this.context.destination)
      }
      this.publish({ enabled: true, loading: true, failed: false })
      await this.context.resume()
      if (generation !== this.generation || !this.state.enabled) return
      this.master?.gain.setTargetAtTime(1, this.context.currentTime, .12)
      this.loading ||= this.load()
      await this.loading
      if (generation !== this.generation || !this.state.enabled) return
      if (!this.tracks.size) throw new Error('No audio tracks could be decoded')
      this.loading = null
      this.publish({ enabled: true, loading: false, failed: this.tracks.size < Object.keys(AUDIO_TRACKS).length })
      this.mix()
    } catch {
      if (generation !== this.generation) return
      this.mute()
      this.loading = null
      this.publish({ enabled: false, loading: false, failed: true })
    }
  }

  private async load() {
    const context = this.context!, master = this.master!, generation = this.generation
    const controller = this.controller = new AbortController()
    const names = Object.keys(AUDIO_TRACKS) as SoundName[]
    // Bound decode concurrency so opting into audio does not stall scrolling.
    for (let offset = 0; offset < names.length; offset += 3) {
      if (controller.signal.aborted) return
      await Promise.allSettled(names.slice(offset, offset + 3).map(async name => {
        if (this.tracks.has(name)) return
        const spec = AUDIO_TRACKS[name]
        const response = await fetch(`/audio/${spec.file}.ogg`, { signal: controller.signal })
        if (!response.ok) throw new Error(`Audio: ${response.status}`)
        const buffer = await context.decodeAudioData(await response.arrayBuffer())
        if (generation !== this.generation) return
        const gain = context.createGain()
        gain.gain.value = spec.volume
        gain.connect(master)
        const track: Track = { buffer, gain }
        this.tracks.set(name, track)
        if (spec.loop) this.start(name, track)
        this.mix()
      }))
    }
  }

  private start(name: SoundName, track: Track) {
    const context = this.context
    if (!context) return
    track.source?.stop()
    track.source?.disconnect()
    const source = context.createBufferSource()
    source.buffer = track.buffer
    source.loop = AUDIO_TRACKS[name].loop
    source.connect(track.gain)
    track.source = source
    source.onended = () => { source.disconnect(); if (track.source === source) track.source = undefined }
    source.start()
  }

  cue(name: SoundName) {
    const context = this.context, track = this.tracks.get(name)
    if (!this.state.enabled || !context || context.state !== 'running' || document.hidden || !track || AUDIO_TRACKS[name].loop) return
    const group = name.startsWith('beeps') ? 'beeps' : name
    const now = context.currentTime, cooldown = group === 'beeps' ? .4 : .12
    if (now - (this.lastCue.get(group) ?? -Infinity) < cooldown) return
    this.lastCue.set(group, now)
    this.start(name, track)
  }

  excite(kind: keyof PortfolioAudio['pulse'], strength: number) {
    this.pulse[kind] = Math.min(1, Math.max(this.pulse[kind], strength))
  }

  update(progress: number, delta: number) {
    this.progress = progress
    const dt = Math.min(delta, .1)
    for (const kind of ['shard', 'particles', 'brand'] as const) this.pulse[kind] *= Math.exp(-3 * dt)
    this.elapsed += dt
    if (this.elapsed >= 1 / 30) { this.elapsed = 0; this.mix() }
  }

  private mix() {
    if (!this.context || !this.state.enabled) return
    const levels = audioMix(this.progress, this.pulse.shard, this.pulse.particles, this.pulse.brand)
    for (const name of Object.keys(levels) as (keyof typeof levels)[]) {
      this.tracks.get(name)?.gain.gain.setTargetAtTime(levels[name], this.context.currentTime, .08)
    }
  }

  detail(open: boolean) {
    this.cancelTimers()
    if (!open) { this.cue('leave'); return }
    this.cue('click')
    this.later('enter', 100)
    this.later('text', 750)
  }

  private later(name: SoundName, delay: number) {
    if (!this.state.enabled || document.hidden) return
    const timer = setTimeout(() => { this.timers.delete(timer); this.cue(name) }, delay)
    this.timers.add(timer)
  }
  private cancelTimers() { this.timers.forEach(clearTimeout); this.timers.clear() }
  private stopCues() {
    for (const [name, track] of this.tracks) if (!AUDIO_TRACKS[name].loop) {
      track.source?.stop(); track.source?.disconnect(); track.source = undefined
    }
  }
  private mute() {
    this.cancelTimers(); this.stopCues()
    if (this.context) this.master?.gain.setTargetAtTime(0, this.context.currentTime, .04)
    this.publish({ ...this.state, enabled: false, loading: false })
  }

  visibility = () => {
    if (!this.context) return
    this.cancelTimers(); this.stopCues()
    if (document.hidden) void this.context.suspend().catch(() => {})
    else if (this.state.enabled) void this.context.resume().catch(() => this.mute())
  }

  dispose() {
    this.generation++
    this.controller?.abort(); this.cancelTimers()
    for (const track of this.tracks.values()) { track.source?.stop(); track.source?.disconnect(); track.gain.disconnect() }
    this.tracks.clear(); this.lastCue.clear()
    this.master?.disconnect()
    void this.context?.close().catch(() => {})
    this.context = null; this.master = null; this.loading = null
    this.pulse = { shard: 0, particles: 0, brand: 0 }
    this.publish(initialState)
  }
}

// No AudioContext, fetch, or timer exists until a visitor enables sound.
export const portfolioAudio = new PortfolioAudio()
