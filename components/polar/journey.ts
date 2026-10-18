export type Journey = { target: number; value: number }
export const CRYSTAL_KINDS = ['skills','projects','about'] as const
export type CrystalKind = typeof CRYSTAL_KINDS[number]
export const JOURNEY_END = 10
export const isCrystalKind = (value: unknown): value is CrystalKind => CRYSTAL_KINDS.some(kind=>kind===value)
export const crystalCenter = (kind: CrystalKind) => CRYSTAL_KINDS.indexOf(kind)+1

export const clamp = (value: number) => Math.min(1, Math.max(0, value))
export const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start))
export const ease = (value: number) => value * value * (3 - 2 * value)

// Preserve every center as the journey grows; each following crystal occupies
// one interval with the reference scene's 5.75-unit vertical spacing.
export function crystalJourney(value: number) {
  const exchange = range(value, 1, 2)
  const aboutExchange = range(value, 2, 3)
  return {
    exchange,
    // All crystals use the same linear scroll distance. Smoothing belongs to
    // the shared journey controller; easing a single shard here slows it twice.
    skillsY: (value-1)*5.75,
    projectsY: (value-2)*5.75,
    aboutY: (value-3)*5.75,
    skillsOpacity: ease(range(value,.83,1)) * (1-ease(range(exchange,0,.3))),
    projectsOpacity: ease(range(exchange,.25,.75)) * (1-ease(range(aboutExchange,0,.3))),
    aboutOpacity: ease(range(aboutExchange,.25,.75)) * (1-ease(range(value,3,3.3))),
    skillsInteractive: value > .6 && value < 1.6,
    projectsInteractive: value > 1.35 && value < 2.6,
    aboutInteractive: value > 2.35 && value < 3.6,
  }
}

// One trajectory: the retreat keeps moving while the curtain and shard rise.
export function journeyView(value: number) {
  const travel = value > 8.6 ? 1-ease(range(value,8.6,9.8)) : ease(clamp(value))
  return {
    zoom: 1 - (1-travel)*(1-travel),
    lift: travel*travel,
    mist: ease(range(travel,.08,.96)),
    crystal: ease(range(travel,.42,1)),
    distortion: Math.sin(travel*Math.PI),
  }
}
