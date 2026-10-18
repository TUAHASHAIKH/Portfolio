export type Journey = { target: number; value: number }
export const JOURNEY_END = 2

export const clamp = (value: number) => Math.min(1, Math.max(0, value))
export const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start))
export const ease = (value: number) => value * value * (3 - 2 * value)

function hermite(from: number, to: number, fromSlope: number, toSlope: number, t: number, span: number) {
  return (2*t*t*t-3*t*t+1)*from+(t*t*t-2*t*t+t)*span*fromSlope
    +(-2*t*t*t+3*t*t)*to+(t*t*t-t*t)*span*toSlope
}

const arrivalAt = (value: number) => -3.2*(1-journeyView(value).crystal)
const arrivalStart = .7
const arrivalU = (ease(arrivalStart)-.42)/.58
const arrivalSlope = 3.2*6*arrivalU*(1-arrivalU)*6*arrivalStart*(1-arrivalStart)/.58

function skillsHeight(value: number) {
  if(value<arrivalStart)return arrivalAt(value)
  // Match both position and velocity at the center, with no hold or reversal.
  if(value<=1)return hermite(arrivalAt(arrivalStart),0,arrivalSlope,2,range(value,arrivalStart,1),1-arrivalStart)
  if(value<1.3)return hermite(0,.3*5.75,2,5.75,range(value,1,1.3),.3)
  return (value-1)*5.75
}

// Keep the original 0..1 hero journey intact. The next interval carries both
// shards through the same 5.75-unit vertical spacing as the reference scene.
export function crystalJourney(value: number) {
  const exchange = range(value, 1, JOURNEY_END)
  return {
    exchange,
    // Blend through the resting pose with a nonzero slope, rather than ending
    // the entrance, holding, and starting another movement at the center.
    skillsY: skillsHeight(value),
    skillsOpacity: ease(range(value,.83,1)) * (1-ease(range(exchange,0,.3))),
    projectsOpacity: ease(range(exchange,.25,.75)),
    skillsInteractive: value > .6 && value < 1.6,
    projectsInteractive: value > 1.35,
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
