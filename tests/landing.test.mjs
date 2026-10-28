import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source=await readFile(new URL('../components/polar/landing-motion.ts',import.meta.url),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {landingPose,advanceLanding,LANDING_DURATION}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('landing stages preserve the wireframe lead, delayed ground, and final clean scene',()=>{
  const initial=landingPose(0),outline=landingPose(1),ice=landingPose(2),ground=landingPose(2.1),done=landingPose(LANDING_DURATION)
  assert.equal(initial.iceVisible,false)
  assert.equal(initial.terrainAlpha,0)
  assert(outline.outlineReveal>0 && outline.cageAlpha>0)
  assert.equal(outline.iceVisible,false)
  assert(ice.iceReveal>0 && ice.iceReveal<1)
  assert.equal(ice.camera,0,'The camera must hold the overhead view during the first materialization')
  assert.equal(ice.terrainAlpha,0)
  assert.equal(ground.terrainAlpha,1)
  assert(ground.terrainFill>0 && ground.terrainFill<1)
  assert.equal(landingPose(3.35).iceReveal,1)
  assert.equal(landingPose(4.49).introduced,false)
  assert.equal(landingPose(4.5).introduced,true)
  for(const key of ['iceReveal','terrainScan','terrainFill','camera','sky','mist','snow'])assert.equal(done[key],1,key)
  for(const key of ['outlineAlpha','cageAlpha','numbersAlpha'])assert.equal(done[key],0,key)
  assert.equal(done.complete,true)
})

test('all reveal curves remain bounded and move forward without discontinuities',()=>{
  const increasing=['iceReveal','outlineReveal','cageReveal','numbersReveal','terrainScan','terrainFill','camera','pointer','sky','mist','snow']
  let previous=landingPose(-1)
  for(let i=-99;i<=830;i++){
    const next=landingPose(i/100)
    for(const [key,value] of Object.entries(next))if(typeof value==='number')assert(Number.isFinite(value)&&value>=0&&value<=1,`${key} ${value}`)
    for(const key of increasing){assert(next[key]>=previous[key]-1e-9,key);assert(next[key]-previous[key]<.03,`${key} jumps between frames`)}
    previous=next
  }
})

test('loading stalls and hidden-tab gaps cannot jump over the intro; reduced motion skips it',()=>{
  assert.equal(advanceLanding(0,12,false),.05)
  assert.equal(advanceLanding(1,-1,false),1)
  assert.equal(advanceLanding(LANDING_DURATION-.01,1,false),LANDING_DURATION)
  for(const time of [-1,0,1,3,7]){
    assert.deepEqual(landingPose(time,true),landingPose(LANDING_DURATION))
    assert.equal(advanceLanding(time,0,true),LANDING_DURATION)
  }
})
