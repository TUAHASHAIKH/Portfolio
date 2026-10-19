import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import vm from 'node:vm'

// Exercise the actual pure TypeScript controller without adding a test runner.
const source = await readFile(new URL('../components/polar/journey.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } })
const journeyUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
const { crystalJourney, crystalPose, CRYSTAL_KINDS, crystalCenter, JOURNEY_END, journeyView, returnProgress, returnChoreography } = await import(journeyUrl)
const ringsSource = await readFile(new URL('../components/polar/ring-journey.ts', import.meta.url), 'utf8')
const ringsCode = ts.transpileModule(ringsSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.replace("'./journey'",JSON.stringify(journeyUrl))
const ringsUrl=`data:text/javascript;base64,${Buffer.from(ringsCode).toString('base64')}`
const { ringJourney } = await import(ringsUrl)
const scrollSource=await readFile(new URL('../components/polar/scroll-path.ts',import.meta.url),'utf8')
const scrollCode=ts.transpileModule(scrollSource,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  .replace("'./journey'",JSON.stringify(journeyUrl)).replace("'./ring-journey'",JSON.stringify(ringsUrl))
const {scrollToJourney,journeyToScroll}=await import(`data:text/javascript;base64,${Buffer.from(scrollCode).toString('base64')}`)
const motionSource=await readFile(new URL('../components/polar/journey-motion.ts',import.meta.url),'utf8')
const motionCode=ts.transpileModule(motionSource,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace("'./journey'",JSON.stringify(journeyUrl))
const {advanceJourney,loopSettled,reverseAtBoundary}=await import(`data:text/javascript;base64,${Buffer.from(motionCode).toString('base64')}`)

test('reverse crossing waits for the matching pose and retains the requested backward distance',()=>{
  for(const fps of [30,60,120]){
    const state={value:.3,target:0,reverseTarget:9.82},motion={velocity:-.4}
    assert(!reverseAtBoundary(state,motion),'Never jump while the opening scene is moving')
    let crossed=false
    for(let frame=0;frame<fps*3;frame++){
      advanceJourney(state,motion,1/fps,false)
      if(reverseAtBoundary(state,motion)){crossed=true;break}
    }
    assert(crossed)
    assert.equal(state.value,10)
    assert.equal(state.target,9.82)
    assert.equal(state.reverseTarget,undefined)
    assert.deepEqual(journeyView(state.value),journeyView(0))
    const before=state.value
    advanceJourney(state,motion,1/fps,false)
    assert(state.value<before&&before-state.value<1.5/fps,'Reverse departure uses the same smooth controller')
  }
})

test('the first crystal uses the same entry pose as the other crystals below the center',()=>{
  for(let offset=-.45;offset<.15;offset+=.005){
    const poses=CRYSTAL_KINDS.map(kind=>crystalPose(crystalCenter(kind)+offset,kind))
    for(const pose of poses){assert(Math.abs(pose.y-poses[1].y)<1e-10);assert.equal(pose.visible,true)}
    assert(Math.abs(poses[0].roll-poses[1].roll)<1e-10)
    assert(Math.abs(poses[0].roll+poses[2].roll)<1e-10)
  }
})

test('large input bursts traverse continuously at matching speeds across frame rates',()=>{
  const endings=[]
  for(const fps of [30,60,120]){
    const state={value:8.3,target:10},motion={velocity:0}
    for(let frame=0;frame<fps;frame++){
      const previous=state.value
      advanceJourney(state,motion,1/fps,false)
      assert(state.value>=previous&&state.value-previous<=1.5/fps+1e-10,'A wheel burst cannot skip the return')
    }
    endings.push(state.value)
    assert(!loopSettled(state,motion),'The loop must not reset before it settles')
    for(let frame=0;frame<fps*3;frame++)advanceJourney(state,motion,1/fps,false)
    assert(loopSettled(state,motion))
  }
  assert(Math.max(...endings)-Math.min(...endings)<1e-9)
})

test('continued input after wrapping immediately advances the next lap at a bounded speed',()=>{
  const next={value:0,target:0},nextMotion={velocity:0}
  for(let tick=0;tick<60;tick++){
    next.target+=.01
    const previous=next.value
    advanceJourney(next,nextMotion,1/60,false)
    assert(next.value>previous,'No cursor movement or new gesture is required')
    assert(next.value-previous<=1.5/60,'Continued input cannot teleport past the hero')
  }
  const state={value:9.9,target:10},motion={velocity:1}
  assert(!loopSettled(state,motion),'Matching scenery alone does not justify dropping camera velocity')
  advanceJourney(state,motion,1/60,true)
  assert(loopSettled(state,motion),'Reduced motion remains immediate')
})

test('native scroll follows one continuous reversible path without changing crystal sensitivity',()=>{
  let previous=0
  for(let scroll=0;scroll<=JOURNEY_END;scroll+=.001){
    const value=scrollToJourney(scroll)
    assert(value>=previous&&value-previous<.01,'No reversal, dead input, or abrupt section jump')
    assert(Math.abs(journeyToScroll(value)-scroll)<1e-9,'Hover and native navigation use the same inverse')
    if(scroll<=3.25||scroll>=8.3)assert(Math.abs(value-scroll)<1e-12)
    previous=value
  }
  assert.equal(scrollToJourney(0),0)
  assert.equal(scrollToJourney(JOURNEY_END),JOURNEY_END)
  assert(journeyToScroll(8.3)-journeyToScroll(7.25)<(8.3-7.25)*.8,'The stationary contact stretch must require less scrolling')
  for(const boundary of [3.25,8.3]){
    const step=.001
    assert(Math.abs((scrollToJourney(boundary+step)-scrollToJourney(boundary-step))/(2*step)-1)<.01,'Sensitivity joins the neighboring section smoothly')
  }
})

test('equal scroll gestures move every crystal equally through its center', () => {
  for (const direction of [-1, 1]) {
    for (let offset = -.3; offset <= .3; offset += .01) {
      const movements = CRYSTAL_KINDS.map(kind => {
        const start = crystalCenter(kind) + offset
        return crystalJourney(start + direction*.01)[`${kind}Y`] - crystalJourney(start)[`${kind}Y`]
      })
      assert(movements.every(distance => Math.sign(distance) === direction), 'Scrolling must keep moving every crystal')
      for (const distance of movements) {
        assert(Math.abs(distance - movements[1]) < 1e-10, `A crystal slows independently near offset ${offset}`)
      }
    }
  }
})

test('hover centering destinations still match all three resting poses', () => {
  for (const kind of CRYSTAL_KINDS) {
    assert.equal(crystalJourney(crystalCenter(kind))[`${kind}Y`], 0)
  }
})

test('adding the passage preserves the native scroll distance to every crystal', async () => {
  const css = await readFile(new URL('../app/globals.css',import.meta.url),'utf8')
  const trackHeight = Number(css.match(/\.journey-track\{height:(\d+)svh/)[1])
  assert.equal((trackHeight-100)/JOURNEY_END,220)
  for(const kind of CRYSTAL_KINDS) {
    assert.equal(crystalJourney(crystalCenter(kind))[`${kind}Interactive`],true)
  }
  const afterCrystals=crystalJourney(4)
  for(const kind of CRYSTAL_KINDS){
    assert.equal(afterCrystals[`${kind}Interactive`],false)
    assert.equal(afterCrystals[`${kind}Opacity`],0)
  }
})

test('the ring camera descends continuously through every portal in either direction', () => {
  let previous=ringJourney(3.25)
  for(let p=3.2501;p<=JOURNEY_END;p+=.0001){
    const next=ringJourney(p)
    for(const key of ['y','z','targetY','targetZ','roll','upright','fov','opacity','proximity','floor','core','coreGlow']) {
      assert(Number.isFinite(next[key]),`${key} must stay finite`)
      assert(Math.abs(next[key]-previous[key])<.02,`${key} jumps at ${p}`)
    }
    assert(next.y<=previous.y+.001,'Descent must not reverse or snap between rings')
    previous=next
  }
  assert.equal(ringJourney(3).opacity,0)
  assert.equal(ringJourney(JOURNEY_END).coreGlow,0)
  assert(ringJourney(JOURNEY_END).floor>.6,'The final disc must be revealed')
})

test('the infinite journey ends in the same camera pose as its beginning',()=>{
  assert.deepEqual(journeyView(JOURNEY_END),journeyView(0))
  assert.equal(ringJourney(JOURNEY_END).opacity,0)
  assert.equal(ringJourney(JOURNEY_END).contact,0)
  assert.equal(ringJourney(7.2).contact,1)
  assert.equal(ringJourney(3).contact,0)
})

test('the return advances upward continuously without a second camera zoom',()=>{
  assert.equal(returnProgress(8.6),0)
  assert.equal(returnProgress(9.8),1)
  let previous=0
  for(let value=8.601;value<9.8;value+=.001){
    const next=returnProgress(value)
    assert(next>previous,'The upward movement must keep advancing with scroll')
    assert(next-previous<.002,'The return must not jump between stages')
    assert.equal(journeyView(value).zoom,0,'The hero keeps its final framing during the upward reveal')
    previous=next
  }
})

test('the contact retreats while loose igloo blocks arrive and assemble',()=>{
  const before=ringJourney(8.3),retreated=ringJourney(9.5)
  assert(retreated.z<before.z-1.4,'The contact camera must retreat into depth')
  assert(returnChoreography(8.6).retreat>0,'Zoom-out starts before the igloo arrives')
  const overlap=returnChoreography(9.05)
  assert(overlap.arrival>0&&overlap.arrival<1)
  assert(overlap.scatter>.5,'Visible blocks remain separated during the handoff')
  let previous=returnChoreography(8.3)
  for(let value=8.301;value<=9.8;value+=.001){
    const next=returnChoreography(value)
    for(const key of ['retreat','departure','arrival','scatter']){
      assert(Math.abs(next[key]-previous[key])<.003,`${key} must remain continuous`)
      assert(key==='scatter'?next[key]<=previous[key]:next[key]>=previous[key])
    }
    previous=next
  }
  assert.equal(returnChoreography(9.8).scatter,0,'Blocks settle before the loop rebases')
  assert.equal(returnChoreography(9.8).arrival,1)
})

test('the full landscape settles with no velocity or acceleration snap',()=>{
  const arrival=value=>returnChoreography(value).arrival
  const step=.0001
  for(const endpoint of [8.35,9.7]){
    const left=(arrival(endpoint)-arrival(endpoint-step))/step
    const right=(arrival(endpoint+step)-arrival(endpoint))/step
    assert(Math.abs(left)<.00001&&Math.abs(right)<.00001,'Arrival starts and ends at rest')
    const acceleration=(arrival(endpoint+step)-2*arrival(endpoint)+arrival(endpoint-step))/(step*step)
    assert(Math.abs(acceleration)<.001,'Acceleration must meet the resting pose continuously')
  }
  assert(arrival(9.05)>.5,'The landscape overlaps the departing contact scene')
})

test('the worker creates complete, finite particle targets for both social silhouettes',async()=>{
  const source=await readFile(new URL('../public/workers/ring-core.js',import.meta.url),'utf8')
  const size=8,data=new Uint8Array(size**3*4),mask=new Uint8Array(256**2)
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const point=[x-3.5,y-3.5,z-3.5],distance=Math.hypot(...point),offset=((z*size+y)*size+x)*4
    for(let axis=0;axis<3;axis++)data[offset+axis]=Math.round((point[axis]/distance+1)*127.5)
    data[offset+3]=Math.max(0,Math.min(255,127.5+(distance-2)*40))
  }
  for(let y=32;y<224;y++)for(let x=32;x<224;x++)mask[y*256+x]=255
  let result
  const context=vm.createContext({self:{postMessage:value=>{result=value}}})
  vm.runInContext(source,context)
  context.self.onmessage({data:{data,size,masks:[mask,mask]}})
  assert(result.positions.length>0)
  assert.equal(result.social.length,2)
  for(const target of result.social){
    assert.equal(target.positions.length,result.positions.length)
    assert.equal(target.normals.length,result.normals.length)
    assert(target.positions.every(Number.isFinite))
    assert(target.normals.every(Number.isFinite))
    assert(target.positions.every(position=>Math.abs(position)<.3))
  }
})
