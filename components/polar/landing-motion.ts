const phase = (time: number, start: number, duration: number) => time <= start ? 0 : time >= start + duration ? 1 : (time - start) / duration
const powerInOut = (t: number, power: number) => t < .5 ? Math.pow(t * 2, power) / 2 : 1 - Math.pow((1 - t) * 2, power) / 2

// Solve the reference's authored timing curves, including their horizontal
// control points. Evaluating just the Y polynomial changes the reveal order.
function curve(t: number, x1: number, y1: number, x2: number, y2: number) {
  if (t <= 0 || t >= 1) return t
  const cubic = (u: number, a: number, b: number) => 3 * (1-u) * (1-u) * u * a + 3 * (1-u) * u * u * b + u * u * u
  let low = 0, high = 1
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2
    if (cubic(mid, x1, x2) < t) low = mid
    else high = mid
  }
  return cubic((low + high) / 2, y1, y2)
}

export const LANDING_DURATION = 8.2

export function landingPose(time: number, reduced = false) {
  const t = reduced ? LANDING_DURATION : time
  const terrain = phase(t, .7, 7.5)
  return {
    iceVisible: t >= 1.1,
    iceReveal: curve(phase(t, 1.1, 2.25), .662, .073, .047, 1),
    breathing: phase(t, 2, 2),
    outlineReveal: powerInOut(phase(t, 0, 2.5), 4),
    outlineAlpha: 1 - curve(phase(t, 2, 3), .4, 0, -.06, 1),
    cageReveal: (1 - Math.cos(phase(t, 0, 4) * Math.PI)) / 2,
    cageAlpha: .4 * powerInOut(phase(t, 0, .1), 3) * (1 - powerInOut(phase(t, 2.1, 3), 3)),
    numbersReveal: Math.sin(phase(t, .5, 4) * Math.PI / 2),
    numbersAlpha: 1 - phase(t, 1.75, 2),
    terrainScan: curve(terrain, .5, 0, .1, 1),
    terrainFill: curve(terrain, .6, 0, 0, 1),
    terrainAlpha: t >= 2.1 ? 1 : 0,
    mountainAlpha: powerInOut(phase(t, .7, 3), 3),
    camera: curve(phase(t, 2, 5.5), .5, 0, .1, 1),
    pointer: powerInOut(phase(t, 2, 5), 3),
    sky: powerInOut(phase(t, 1.5, 3), 3),
    mist: powerInOut(phase(t, 2, 3), 3),
    snow: powerInOut(phase(t, 2, 4), 3),
    introduced: t >= 4.5,
    complete: t >= LANDING_DURATION,
  }
}

// Asset/shader compilation and a resumed tab must not skip the wireframe stage.
export function advanceLanding(time: number, delta: number, reduced: boolean) {
  return reduced ? LANDING_DURATION : Math.min(LANDING_DURATION, time + Math.max(0, Math.min(delta, .05)))
}
