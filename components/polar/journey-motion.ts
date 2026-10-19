import { JOURNEY_END, type Journey } from './journey'

export type JourneyMotion = { velocity: number }

// Bound traversal, not rendering quality. Small fixed integration steps keep
// burst handling equivalent at 30, 60 and 120 Hz, including direction changes.
export function advanceJourney(state: Journey, motion: JourneyMotion, elapsed: number, reduced: boolean) {
  if(reduced){state.value=state.target;motion.velocity=0;return}
  const steps=Math.max(1,Math.ceil(Math.min(elapsed,.25)*120))
  const dt=Math.min(elapsed,.25)/steps,rate=14,maxSpeed=1.5
  for(let i=0;i<steps;i++){
    const target=state.value+Math.max(-2*maxSpeed/rate,Math.min(2*maxSpeed/rate,state.target-state.value))
    const offset=state.value-target,decay=Math.exp(-rate*dt)
    const impulse=motion.velocity+rate*offset
    const next=target+(offset+impulse*dt)*decay
    const velocity=(motion.velocity-rate*impulse*dt)*decay
    const movement=Math.max(-maxSpeed*dt,Math.min(maxSpeed*dt,next-state.value))
    state.value=Math.max(0,Math.min(JOURNEY_END,state.value+movement))
    motion.velocity=Math.max(-maxSpeed,Math.min(maxSpeed,velocity))
  }
  if(Math.abs(state.target-state.value)<.00001&&Math.abs(motion.velocity)<.0001){state.value=state.target;motion.velocity=0}
}

export const loopSettled = (state: Journey, motion: JourneyMotion) =>
  state.target===JOURNEY_END&&state.value>JOURNEY_END-.0001&&Math.abs(motion.velocity)<.002

export function reverseAtBoundary(state:Journey,motion:JourneyMotion) {
  if(state.reverseTarget===undefined||state.target!==0||state.value>.0001||Math.abs(motion.velocity)>=.002)return false
  state.value=JOURNEY_END
  state.target=state.reverseTarget
  delete state.reverseTarget
  motion.velocity=0
  return true
}
