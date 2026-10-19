import { clamp, ease, range, JOURNEY_END } from './journey'
import { ringJourney } from './ring-journey'

// Native wheel, touch and keyboard input all use this same reversible path.
// Allocate distance to camera travel instead of the duration of the source
// animation. Keep the crystal intervals and both loop endpoints unchanged.
const start=3.25, end=8.3, samples=1024, step=(end-start)/samples
const distance=new Float64Array(samples+1)
const density=new Float64Array(samples+1)
const envelope=(value:number)=>ease(range(value,start,start+.5))*(1-ease(range(value,end-.5,end)))
function speed(value:number) {
  const a=ringJourney(Math.max(start,value-step*.5)),b=ringJourney(Math.min(end,value+step*.5))
  return .25+Math.hypot((b.y-a.y)*.42,(b.z-a.z)*1.5,(b.roll-a.roll)*.65,
    (b.upright-a.upright)*.7,(b.fov-a.fov)*.035,(b.floor-a.floor)*.6,(b.contact-a.contact)*.6)/step
}
let weighted=0,weight=0
for(let i=0;i<=samples;i++){
  const value=start+i*step,edge=i===0||i===samples?.5:1
  density[i]=speed(value)
  weighted+=density[i]*envelope(value)*edge
  weight+=envelope(value)*edge
}
const mean=weighted/weight
for(let i=0;i<=samples;i++)density[i]=1+.85*envelope(start+i*step)*(density[i]/mean-1)
for(let i=1;i<=samples;i++)distance[i]=distance[i-1]+(density[i-1]+density[i])*.5*step
const scale=(end-start)/distance[samples]
for(let i=0;i<=samples;i++)distance[i]=start+distance[i]*scale

export function scrollToJourney(scroll:number) {
  const value=clamp(scroll/JOURNEY_END)*JOURNEY_END
  if(value<=start||value>=end)return value
  let low=0,high=samples
  while(high-low>1){const middle=(low+high)>>>1;if(distance[middle]<value)low=middle;else high=middle}
  return start+(low+(value-distance[low])/(distance[high]-distance[low]))*step
}

export function journeyToScroll(journey:number) {
  const value=clamp(journey/JOURNEY_END)*JOURNEY_END
  if(value<=start||value>=end)return value
  const index=(value-start)/step,low=Math.floor(index)
  return distance[low]+(distance[low+1]-distance[low])*(index-low)
}

// Preserve the part of a gesture that crosses native zero, just as forward
// scrolling preserves distance beyond the bottom. Do not park queued input at
// the contact section while the renderer is still crossing the loop boundary.
export function reverseScrollTarget(previous:number|undefined,pixels:number,scroll:number,distance:number) {
  const excess=Math.max(0,pixels-scroll)
  if(!excess)return previous
  return Math.max(.001,(previous??JOURNEY_END)-excess/Math.max(1,distance)*JOURNEY_END)
}
