'use client'

import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree,type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Journey } from './journey'
import { ringJourney } from './ring-journey'
import { ParticleField } from './particle-field'
import { SOCIAL_LINKS,socialIndex } from './social-links'

export function SocialParticles({core,material,journey,reduced,virtual}:{core:React.RefObject<THREE.Points|null>;material:THREE.ShaderMaterial;journey:React.RefObject<Journey>;reduced:boolean;virtual:THREE.PerspectiveCamera}){
  const {gl}=useThree()
  const plane=useRef<THREE.Mesh>(null)
  const selected=useRef(0),tail=useRef(0),active=useRef(false),wasReduced=useRef(reduced)
  const wasEnabled=useRef(false)
  const field=useMemo(()=>new ParticleField(),[])
  const pointer=useMemo(()=>({brush:new THREE.Vector2(10,10),last:new THREE.Vector2(10,10),velocity:new THREE.Vector2(),point:new THREE.Vector3(),initialized:false}),[])
  const weights=useMemo(()=>new THREE.Vector3(1,0,0),[])
  useEffect(()=>{
    field.clear(gl);material.uniforms.scatterField.value=field.texture
    void field.prepare(gl).catch(error=>console.error('Particle field preparation:',error))
    return()=>field.dispose()
  },[field,gl,material])
  useEffect(()=>{
    const select=(event:Event)=>{
      const detail=(event as CustomEvent<unknown>).detail
      if(typeof detail==='number'&&Number.isInteger(detail))selected.current=socialIndex(detail)
      active.current=false
    }
    window.addEventListener('portfolio:social-select',select)
    return()=>window.removeEventListener('portfolio:social-select',select)
  },[])
  const leave=()=>{active.current=false;pointer.initialized=false;gl.domElement.style.cursor=''}
  useEffect(()=>{window.addEventListener('blur',leave);return()=>{window.removeEventListener('blur',leave);leave()}},[gl])
  const move=(event:ThreeEvent<PointerEvent>)=>{
    if(ringJourney(journey.current.value).contact<.1)return
    gl.domElement.style.cursor='pointer'
    if(event.pointerType==='touch'||reduced||!core.current)return
    event.stopPropagation();core.current.worldToLocal(pointer.point.copy(event.point))
    pointer.brush.set(pointer.point.x/.6+.5,pointer.point.y/.6+.5)
    if(!pointer.initialized){pointer.last.copy(pointer.brush);pointer.initialized=true}
    active.current=true;tail.current=2
  }
  useFrame((_,delta)=>{
    const travel=ringJourney(journey.current.value),enabled=travel.contact>.05
    if(plane.current){plane.current.visible=enabled;plane.current.quaternion.copy(virtual.quaternion)}
    if(!enabled&&active.current)leave()
    if(!enabled&&wasEnabled.current){field.clear(gl);tail.current=0}
    wasEnabled.current=enabled
    const dt=Math.min(delta,.05)
    const shape=journey.current.value<6.35?0:selected.current
    for(let index=0;index<3;index++)weights.setComponent(index,reduced?Number(index===shape):THREE.MathUtils.damp(weights.getComponent(index),Number(index===shape),9,dt))
    material.uniforms.socialWeights.value.copy(weights)
    if(wasReduced.current!==reduced){field.clear(gl);wasReduced.current=reduced;active.current=false}
    if(!reduced&&enabled&&(active.current||tail.current>0)){
      pointer.velocity.subVectors(pointer.brush,pointer.last).divideScalar(Math.max(dt,.001)).clampLength(0,4)
      field.update(gl,dt,pointer.brush,pointer.last,pointer.velocity,active.current)
      pointer.last.copy(pointer.brush);tail.current=Math.max(0,tail.current-dt)
    }
    material.uniforms.scatterField.value=field.texture
    material.uniforms.socialView.value=travel.chamber
    // Letters stay readable. The GitHub sculpture keeps the slow full rotation.
    if(core.current&&shape!==0)core.current.rotation.y=reduced?0:Math.sin(material.uniforms.time.value*.2)*.14
  },.16)
  return <mesh ref={plane} name="particle-social-target" position={[0,-9.785,0]} renderOrder={13} visible={false} onPointerMove={move} onPointerOut={leave} onClick={event=>{if(ringJourney(journey.current.value).contact<.1)return;event.stopPropagation();window.open(SOCIAL_LINKS[selected.current].href,'_blank','noopener,noreferrer')}}>
    <planeGeometry args={[.6,.72]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>
}
