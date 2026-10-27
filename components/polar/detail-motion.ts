import { clamp, ease, range } from './journey'

// A single reversible playhead drives all detail motion. Keeping this separate
// from the scroll spring prevents opening a page from changing journey speed.
export function detailPose(progress: number) {
  const amount = ease(clamp(progress))
  return {
    amount,
    shell: ease(range(progress, .18, .85)),
    coreScale: 1 + amount * 1.35,
    shellScale: 1 + amount * .3,
    turn: amount * .2,
  }
}
