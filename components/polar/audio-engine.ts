import { AUDIO_TRACKS, type SoundName } from './audio-manifest'
import { audioMix } from './audio-mix'

type Track = { buffer: AudioBuffer; gain: GainNode; level: number; source?: AudioBufferSourceNode }
const initialState = { enabled: true, loading: false, failed: false, playing: false, blocked: false }

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
  private publish(state: typeof initialState) {
    const running = this.context?.state === 'running'
    const next = {
      ...state,
      playing: state.enabled && running && !document.hidden && [...this.tracks.values()].some(track => track.source?.loop),
      blocked: state.enabled && Boolean(this.context) && !running && !document.hidden,
    }
    if (Object.keys(next).every(key => next[key as keyof typeof next] === this.state[key as keyof typeof next])) return
    this.state = next
    this.listeners.forEach(listener => listener())
  }
  private playbackChanged = () => this.publish(this.state)

  // Ask for autoplay permission immediately, without competing with the hero
  // for downloads. The same context is reused when recordings become ready.
  prepare = () => {
    if (!this.state.enabled) return
    try {
      if (!this.context) {
        this.context = new AudioContext()
        this.context.onstatechange = this.playbackChanged
        this.master = this.context.createGain()
        this.master.gain.value = 0
        this.master.connect(this.context.destination)
      }
      this.playbackChanged()
      this.unlock()
    } catch {
      this.publish({ ...this.state, enabled: false, failed: true })
    }
  }

  async toggle() {
    this.playbackChanged()
    if (this.state.enabled && this.state.playing) { this.mute(); return }
    await this.enable()
  }

  // Autoplay may stay suspended until a trusted gesture. Loading must not wait
  // on resume(), whose promise can remain pending under browser autoplay rules.
  unlock = () => {
    if (this.state.enabled && this.context && !document.hidden && this.context.state !== 'running' && this.context.state !== 'closed') {
      void this.context.resume().then(this.playbackChanged).catch(this.playbackChanged)
    }
  }

  async enable() {
    const generation = this.generation
    try {
      // Readiness or a trusted gesture starts loading. Autoplay preparation
      // already created the context, so unlocking never waits for downloads.
      this.publish({ ...this.state, enabled: true, loading: true, failed: false })
      this.prepare()
      if (!this.context) throw new Error('Audio is unavailable')
      this.unlock()
      if (generation !== this.generation || !this.state.enabled) return
      this.master?.gain.setTargetAtTime(1, this.context.currentTime, .12)
      this.loading ||= this.load()
      await this.loading
      if (generation !== this.generation) return
      this.loading = null
      if (!this.state.enabled) return
      if (!this.tracks.size) throw new Error('No audio tracks could be decoded')
      this.publish({ ...this.state, enabled: true, loading: false, failed: this.tracks.size < Object.keys(AUDIO_TRACKS).length })
      this.mix()
    } catch {
      if (generation !== this.generation) return
      this.mute()
      this.loading = null
      this.publish({ ...this.state, enabled: false, loading: false, failed: true })
    }
  }

  private async load() {
    const context = this.context!, master = this.master!, generation = this.generation
    const controller = this.controller = new AbortController()
    const names = Object.keys(AUDIO_TRACKS) as SoundName[]
    // Bound decode concurrency so decoding audio does not stall scrolling.
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
        const track: Track = { buffer, gain, level: spec.volume }
        this.tracks.set(name, track)
        if (spec.loop) this.start(name, track)
        this.playbackChanged()
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
      const track = this.tracks.get(name)
      // Leave an existing ramp running when its destination is unchanged.
      // Requeuing seven identical automation events 30 times/second consumes
      // audio/main-thread work even while autoplay is waiting for permission.
      if (!track || track.level === levels[name]) continue
      track.level = levels[name]
      track.gain.gain.setTargetAtTime(track.level, this.context.currentTime, .08)
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
    else this.unlock()
    this.playbackChanged()
  }

  dispose() {
    this.generation++
    this.controller?.abort(); this.cancelTimers()
    for (const track of this.tracks.values()) { track.source?.stop(); track.source?.disconnect(); track.gain.disconnect() }
    this.tracks.clear(); this.lastCue.clear()
    this.master?.disconnect()
    if (this.context) this.context.onstatechange = null
    void this.context?.close().catch(() => {})
    this.context = null; this.master = null; this.loading = null
    this.pulse = { shard: 0, particles: 0, brand: 0 }
    this.publish(initialState)
  }
}

// Construction is side-effect free; the mounted soundscape enables playback.
export const portfolioAudio = new PortfolioAudio()
