export const AUDIO_TRACKS = {
  music: { file: 'music-highq', volume: .2, loop: true },
  room: { file: 'room', volume: .45, loop: true },
  wind: { file: 'wind', volume: 0, loop: true },
  brand: { file: 'ui-brand', volume: 0, loop: true },
  shard: { file: 'shard', volume: 0, loop: true },
  portals: { file: 'circles', volume: 0, loop: true },
  particles: { file: 'particles', volume: 0, loop: true },
  beeps: { file: 'beeps', volume: .5, loop: false },
  beeps2: { file: 'beeps2', volume: .5, loop: false },
  beeps3: { file: 'beeps3', volume: .5, loop: false },
  click: { file: 'click-project', volume: .5, loop: false },
  enter: { file: 'enter-project', volume: .5, loop: false },
  leave: { file: 'leave-project', volume: .5, loop: false },
  text: { file: 'project-text', volume: .5, loop: false },
  logo: { file: 'logo', volume: .3, loop: false },
  long: { file: 'ui-long', volume: .3, loop: false },
  short: { file: 'ui-short', volume: .3, loop: false },
  manifesto: { file: 'ui-manifesto', volume: .3, loop: false },
} as const
export type SoundName = keyof typeof AUDIO_TRACKS
export const isSoundName = (value: string | undefined): value is SoundName =>
  Boolean(value && Object.hasOwn(AUDIO_TRACKS, value))
