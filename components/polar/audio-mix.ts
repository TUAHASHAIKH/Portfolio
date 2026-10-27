import { ease, range } from './journey'
import { ringJourney } from './ring-journey'

// Follow the rendered camera, not the wheel target: every sound stays attached
// to its scene when the user reverses or crosses the infinite loop seam.
export function audioMix(progress: number, shard = 0, particles = 0, brand = 0) {
  const ring = ringJourney(progress)
  const hero = Math.max(1 - ease(range(progress, .15, .95)), ease(range(progress, 8.6, 9.8)))
  const crystal = ease(range(progress, .7, .95)) * (1 - ease(range(progress, 3.2, 3.8)))
  return {
    music: .2,
    room: .45,
    wind: .4 * hero,
    brand: Math.min(1, Math.max(0, brand)) * .12,
    shard: Math.min(1, Math.max(0, shard)) * crystal * .5,
    portals: ring.proximity * ring.opacity * .9,
    particles: ring.contact * (.04 + Math.min(1, Math.max(0, particles)) * .21),
  }
}
