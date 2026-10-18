export type Journey = { target: number; value: number }
export const JOURNEY_END = 2

export const clamp = (value: number) => Math.min(1, Math.max(0, value))
export const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start))
export const ease = (value: number) => value * value * (3 - 2 * value)

// Keep the original 0..1 hero journey intact. The next interval carries both
// shards through the same 5.75-unit vertical spacing as the reference scene.
export function crystalJourney(value: number) {
  const exchange = range(value, 1.1, JOURNEY_END)
  return {
    exchange,
    skillsOpacity: ease(range(value,.83,1)) * (1-ease(range(exchange,0,.3))),
    projectsOpacity: ease(range(exchange,.25,.75)),
    skillsInteractive: value >= .94 && exchange < .12,
    projectsInteractive: exchange > .88,
  }
}

// One trajectory: the retreat keeps moving while the curtain and shard rise.
export function journeyView(value: number) {
  const travel = ease(clamp(value))
  return {
    zoom: 1 - (1-travel)*(1-travel),
    lift: travel*travel,
    mist: ease(range(travel,.08,.96)),
    crystal: ease(range(travel,.42,1)),
    distortion: Math.sin(travel*Math.PI),
  }
}
