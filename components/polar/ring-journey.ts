import { ease, range } from './journey'

// Scroll is the only playhead: all camera and portal poses reverse together.
// These curves preserve the reference's long descent and overlapping roll.
function bezier(value: number, points: number[]) {
  const cubic = (t: number, a: number, b: number, c: number, d: number) => {
    const s = 1-t
    return s*s*s*a+3*s*s*t*b+3*s*t*t*c+t*t*t*d
  }
  let index = 0
  while (index+6 < points.length-2 && value > points[index+6]) index += 6
  let low = 0, high = 1
  for (let i=0;i<16;i++) {
    const middle = (low+high)*.5
    if (cubic(middle,points[index],points[index+2],points[index+4],points[index+6]) < value) low=middle
    else high=middle
  }
  return cubic((low+high)*.5,points[index+1],points[index+3],points[index+5],points[index+7])
}
const descent = [0,0,.272,0,.472,.454,.496,.496,.66,.79,.685,1,1,1]
const returnUp = [0,0,.358,0,.336,.209,.442,.519,.59,.952,.768,.918,1,1]
const powerInOut = (t: number, power: number) => t < .5 ? Math.pow(t*2,power)*.5 : 1-Math.pow((1-t)*2,power)*.5
const pulse = (time: number, start: number, peak: number, end: number) => time<peak ? Math.pow(range(time,start,peak),2) : Math.pow(1-range(time,peak,end),2)

export function ringJourney(value: number) {
  // Keep the existing passage's timing, then continue the same camera path
  // down to eye level in the contact chamber.
  const time = Math.min(9.2,Math.max(0,(value-3.25)*1.8))
  const progress = time/9.2
  const approach = 1-Math.pow(1-range(time,0,2.5),3)
  const settle = bezier(range(time,3.5,7.2),returnUp)
  return {
    progress, time,
    opacity: ease(range(value,3.3,3.9))*(1-ease(range(value,8.8,9.8))),
    y: 1.5-11.33*bezier(range(time,.2,7.2),descent),
    z: -2*(1-approach)-1.5*settle-1.5*bezier(range(time,7.2,9.2),[0,0,.388,.082,.924,.862,1,1]),
    targetY: -2.5-7.5*powerInOut(range(time,.2,3.2),2)+.19*powerInOut(range(time,3.2,5.7),2)-.54*Math.pow(range(time,7.2,9.2),3),
    targetZ: -1*(1-approach),
    roll: Math.PI*powerInOut(range(time,1,6.25),4),
    upright: settle,
    fov: 22+8*powerInOut(range(time,0,7.2),2),
    proximity: Math.max(pulse(time,2,2.5,2.9),pulse(time,2.95,3.45,3.85),pulse(time,3.8,4.3,4.9)),
    floor: 1-Math.pow(1-range(time,3.4,8.4),3),
    core: powerInOut(range(time,1.5,4),3),
    coreGlow: 1-powerInOut(range(time,3.9,4.9),2),
    forming: 1-powerInOut(range(time,3.5,5),2),
    contact: ease(range(value,6.35,7.15))*(1-ease(range(value,8.3,8.8))),
    chamber: ease(range(time,4.5,6.5)),
    returning: ease(range(value,8.6,9.8)),
  }
}
