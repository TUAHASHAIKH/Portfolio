'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Journey } from './journey'
import { loadRingAssets, type RingAssets } from './ring-assets'
import { ringJourney } from './ring-journey'
import { makeRingMaterials } from './ring-materials'

export function Rings(props: { journey: React.RefObject<Journey>; noise: THREE.Texture; reduced: boolean }) {
  const { gl } = useThree()
  const [assets, setAssets] = useState<RingAssets | null>(null)
  useEffect(() => {
    let cancelled = false, loaded: RingAssets | undefined
    void loadRingAssets(gl).then(result => {
      if (cancelled) { result.dispose(); return }
      loaded=result; setAssets(result)
    }).catch(error => { if (!cancelled) console.error('Ring assets:',error) })
    return () => { cancelled=true; loaded?.dispose() }
  },[gl])
  return assets ? <RingPassage {...props} assets={assets} /> : null
}

function RingPassage({ assets, journey, noise, reduced }: { assets: RingAssets; journey: React.RefObject<Journey>; noise: THREE.Texture; reduced: boolean }) {
  const { gl, camera, scene } = useThree()
  const root = useRef<THREE.Group>(null)
  const portals = useRef<(THREE.Mesh | null)[]>([])
  const fields = useRef<(THREE.Mesh | null)[]>([])
  const plasma = useRef<(THREE.Mesh | null)[]>([])
  const floor = useRef<THREE.Mesh>(null), core = useRef<THREE.Points>(null), tunnel = useRef<THREE.Mesh>(null)
  const clock = useRef(0)
  const materials = useMemo(() => makeRingMaterials(assets,noise),[assets,noise])
  const view = useMemo(() => ({ camera:new THREE.PerspectiveCamera(22,1,.02,100), target:new THREE.Vector3(), upright:new THREE.Vector3(0,1,0), scale:new THREE.Matrix4() }),[])
  useEffect(()=>{
    scene.userData.ringBlue=assets.blue;scene.userData.ringScroll=assets.scroll
    return ()=>{delete scene.userData.ringBlue;delete scene.userData.ringScroll;delete scene.userData.ringOpacity;delete scene.userData.ringProximity}
  },[scene,assets])
  useEffect(() => {
    if (!root.current) return
    let cancelled=false
    const warmScene = new THREE.Scene(), copy=root.current.clone(true)
    copy.matrixAutoUpdate=true;copy.matrix.identity();copy.visible=true
    copy.traverse(item=>{item.visible=true;item.frustumCulled=false})
    warmScene.add(copy)
    const warmCamera=new THREE.PerspectiveCamera(30,1,.01,100)
    warmCamera.position.set(0,2,-2);warmCamera.lookAt(0,-3,0)
    const target=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType})
    // Upload every ring, floor and particle shader before entering the passage.
    void gl.compileAsync(warmScene,warmCamera).then(()=>{
      if(cancelled)return
      const previous=gl.getRenderTarget()
      try{gl.setRenderTarget(target);gl.render(warmScene,warmCamera)}
      finally{gl.setRenderTarget(previous);target.dispose()}
      gl.domElement.closest('#app')?.setAttribute('data-rings-ready','true')
    }).catch(error=>{if(!cancelled)console.error('Ring shader preparation:',error)})
    return ()=>{cancelled=true;target.dispose()}
  },[assets,gl])
  useEffect(()=>()=>materials.dispose(),[materials])
  useFrame((state,delta)=>{
    const travel=ringJourney(journey.current.value)
    if(!root.current)return
    root.current.visible=journey.current.value>3.25
    scene.userData.ringOpacity=travel.opacity
    scene.userData.ringProximity=reduced?0:travel.proximity
    if(!root.current.visible)return
    if(!reduced)clock.current+=Math.min(delta,.1)
    const virtual=view.camera
    virtual.position.set(0,travel.y,travel.z)
    const roll=reduced?0:travel.roll
    virtual.up.set(-Math.sin(roll),0,-Math.cos(roll)).lerp(view.upright,travel.upright).normalize()
    virtual.lookAt(view.target.set(0,travel.targetY,travel.targetZ))
    virtual.updateMatrixWorld()
    const actual=camera as THREE.PerspectiveCamera
    const zoom=Math.min(1,state.size.width/state.size.height*1.5)
    const lens=Math.tan(actual.fov*Math.PI/360)/Math.tan(travel.fov*Math.PI/360)*zoom
    // A virtual camera preserves the established hero/crystal camera while
    // projecting the ring passage with its own lens and continuous barrel roll.
    camera.updateMatrixWorld()
    view.scale.makeScale(lens,lens,1)
    root.current.matrix.copy(camera.matrixWorld).multiply(view.scale).multiply(virtual.matrixWorldInverse)
    root.current.matrixWorldNeedsUpdate=true
    const width=state.size.width*gl.getPixelRatio(),height=state.size.height*gl.getPixelRatio()
    for(const material of materials.materials){
      material.uniforms.time.value=clock.current
      material.uniforms.opacity.value=travel.opacity
      material.uniforms.eye.value.copy(virtual.position)
      material.uniforms.resolution.value.set(width,height)
      if(material.uniforms.motion)material.uniforms.motion.value=reduced?0:1
    }
    for(let i=0;i<3;i++){
      const portal=portals.current[i],field=fields.current[i],mist=plasma.current[i]
      const end=[.34,.43,.52][i]*9.2
      if(portal){portal.visible=travel.time<end;portal.rotation.z=roll*.4}
      if(field){field.visible=travel.time>[.1,.25,.36][i]*9.2&&travel.time<end;materials.fields[i].uniforms.ringY.value=-1.5-i*2.5}
      if(mist){mist.visible=travel.time>[.06,.25,.35][i]*9.2&&travel.time<end;mist.rotation.y=i*Math.PI*.5+roll*.5}
    }
    if(tunnel.current){tunnel.current.visible=travel.time<.52*9.2;tunnel.current.rotation.y=roll*.65}
    if(floor.current)floor.current.visible=travel.floor>0
    materials.floor.uniforms.reveal.value=travel.floor
    materials.floor.uniforms.glowFactor.value=.06+travel.coreGlow*.75
    if(core.current){core.current.visible=travel.core>0;core.current.rotation.y=reduced?0:clock.current*.045}
    materials.core.uniforms.reveal.value=travel.core
    materials.core.uniforms.glow.value=travel.coreGlow
    materials.core.uniforms.forming.value=reduced?0:travel.forming
    materials.core.uniforms.pixelRatio.value=gl.getPixelRatio()
  },.15)
  return <group ref={root} name="ring-passage" matrixAutoUpdate={false} visible={false}>
    <mesh material={materials.background} renderOrder={8} frustumCulled={false} raycast={()=>{}}><planeGeometry args={[2,2]} /></mesh>
    {[0,1,2].map(index=><group key={index}>
      <mesh ref={item=>{portals.current[index]=item}} name={`portal-${index+1}`} geometry={index===1?assets.inner:assets.outer} material={materials.rings[index]} position={[0,-1.65-index*2.5,0]} rotation={[-Math.PI/2,0,0]} renderOrder={9} frustumCulled={false} raycast={()=>{}} />
      <mesh ref={item=>{fields.current[index]=item}} material={materials.fields[index]} position={[0,-1.5-index*2.5,0]} rotation={[-Math.PI/2,0,0]} scale={.65} renderOrder={11} frustumCulled={false} raycast={()=>{}}><planeGeometry args={[1,1]} /></mesh>
      <mesh ref={item=>{plasma.current[index]=item}} geometry={assets.plasma} material={materials.plasma} position={[0,-1.6-index*2.5,0]} renderOrder={10} frustumCulled={false} raycast={()=>{}} />
    </group>)}
    <mesh ref={tunnel} material={materials.tunnel} position={[0,-3.5,0]} renderOrder={10} raycast={()=>{}}><cylinderGeometry args={[1.3,1.3,9,48,1,true]} /></mesh>
    <mesh ref={floor} name="ring-disc" geometry={assets.floor} material={materials.floor} position={[0,-10.19,0]} scale={.73} rotation={[0,Math.PI,0]} renderOrder={9} frustumCulled={false} raycast={()=>{}} />
    <points ref={core} name="ring-particle-core" geometry={assets.core} material={materials.core} position={[0,-9.785,0]} renderOrder={10} frustumCulled={false} raycast={()=>{}} />
  </group>
}
