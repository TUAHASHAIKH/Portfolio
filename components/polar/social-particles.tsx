'use client'

import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree,type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Journey } from './journey'
import { ringJourney } from './ring-journey'
import { ParticleSimulation } from './particle-simulation'
import { SOCIAL_LINKS,socialIndex } from './social-links'
import { portfolioAudio } from './audio-engine'

export function SocialParticles({core,geometry,volumes,material,journey,reduced,virtual}:{core:React.RefObject<THREE.Points|null>;geometry:THREE.BufferGeometry;volumes:THREE.Texture[];material:THREE.ShaderMaterial;journey:React.RefObject<Journey>;reduced:boolean;virtual:THREE.PerspectiveCamera}){
  const {gl}=useThree()
  const plane=useRef<THREE.Mesh>(null)
  const selected=useRef(0),active=useRef(false),wasReduced=useRef(reduced)
  const field=useMemo(()=>new ParticleSimulation(geometry,volumes),[geometry,volumes])
  const fieldLifetime=useMemo(()=>({users:0}),[field])
  const pointer=useMemo(()=>({brush:new THREE.Vector2(10,10),last:new THREE.Vector2(10,10),velocity:new THREE.Vector2(),initialized:false,lastMove:0}),[])
  const weights=useMemo(()=>new THREE.Vector4(1,0,0,0),[])
  const view=useMemo(()=>({matrix:new THREE.Matrix4(),rotation:new THREE.Matrix4(),basis:new THREE.Matrix3(),projection:new THREE.Matrix4()}),[])
  useEffect(()=>{
    fieldLifetime.users++
    field.clear();material.uniforms.particlePositions.value=field.position
    const preparation=field.prepare(gl).catch(error=>console.error('Particle field preparation:',error))
    // Strict Mode replays effects using the same field. Do not delete shader
    // programs while compileAsync is still polling them, or while replay uses them.
    return()=>{fieldLifetime.users--;void preparation.then(()=>{if(fieldLifetime.users===0)field.dispose()})}
  },[field,fieldLifetime,gl,material])
  useEffect(()=>{
    const select=(event:Event)=>{
      const detail=(event as CustomEvent<unknown>).detail
      if(typeof detail==='number'&&Number.isInteger(detail)){
        const next=socialIndex(detail)
        if(next!==selected.current&&!reduced)field.transition()
        selected.current=next
      }
      active.current=false
    }
    window.addEventListener('portfolio:social-select',select)
    return()=>window.removeEventListener('portfolio:social-select',select)
  },[field,reduced])
  const leave=()=>{active.current=false;pointer.initialized=false;gl.domElement.style.cursor=''}
  useEffect(()=>{window.addEventListener('blur',leave);return()=>{window.removeEventListener('blur',leave);leave()}},[gl])
  useEffect(()=>{
    const move=(event:PointerEvent)=>{
      if(reduced||event.pointerType==='touch'||ringJourney(journey.current.value).contact<.1)return
      const rect=gl.domElement.getBoundingClientRect(),now=performance.now()
      pointer.brush.set((event.clientX-rect.left)/rect.width,1-(event.clientY-rect.top)/rect.height)
      // Ignore the first position after entering or pausing. It is not a stroke.
      if(!pointer.initialized||now-pointer.lastMove>150)pointer.last.copy(pointer.brush)
      pointer.initialized=true;pointer.lastMove=now;active.current=true
    }
    const out=(event:PointerEvent)=>{if(!event.relatedTarget)leave()}
    window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerout',out)
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerout',out);leave()}
  },[gl,journey,pointer,reduced])
  const hover=(event:ThreeEvent<PointerEvent>)=>{
    if(ringJourney(journey.current.value).contact<.1)return
    event.stopPropagation();gl.domElement.style.cursor='pointer'
  }
  useFrame((_,delta)=>{
    const travel=ringJourney(journey.current.value),enabled=travel.contact>.05
    if(plane.current){plane.current.visible=enabled;plane.current.quaternion.copy(virtual.quaternion)}
    if(!enabled&&active.current)leave()
    const dt=Math.min(delta,.05)
    const shape=journey.current.value<6.35?0:selected.current
    if(core.current)core.current.rotation.y=reduced||shape===0?0:Math.sin(material.uniforms.time.value*.2)*.14
    for(let index=0;index<SOCIAL_LINKS.length;index++)weights.setComponent(index,reduced?Number(index===shape):THREE.MathUtils.damp(weights.getComponent(index),Number(index===shape),9,dt))
    material.uniforms.socialWeights.value.copy(weights)
    if(wasReduced.current!==reduced){field.clear();wasReduced.current=reduced;active.current=false}
    // Form the sculpture before its first visible grain in the ring passage.
    const simulating=!reduced&&journey.current.value>3.25&&journey.current.value<9.8
    if(simulating){
      view.matrix.makeRotationFromQuaternion(virtual.quaternion).invert()
      if(core.current)view.rotation.makeRotationFromQuaternion(core.current.quaternion)
      view.matrix.multiply(view.rotation);view.basis.setFromMatrix4(view.matrix)
      core.current?.updateMatrix()
      view.projection.multiplyMatrices(virtual.projectionMatrix,virtual.matrixWorldInverse)
      if(core.current)view.projection.multiply(core.current.matrix)
      field.orient(view.basis,view.projection,virtual.aspect,material.uniforms.screenLift.value)
      pointer.velocity.subVectors(pointer.brush,pointer.last).divideScalar(Math.max(dt,.001)).clampLength(0,4)
      if(active.current&&enabled)portfolioAudio.excite('particles',pointer.velocity.length()*.3)
      const interaction=THREE.MathUtils.smoothstep(travel.progress,.45,.65)*(1-THREE.MathUtils.smoothstep(travel.progress,.8,.93))
      field.update(gl,dt,weights,pointer.brush,pointer.last,active.current&&enabled,interaction,shape,travel.forming)
      pointer.last.copy(pointer.brush)
    }else field.clear()
    material.uniforms.particlePositions.value=field.position
    material.uniforms.volumeRotation.value=simulating?field.rotation:0
    material.uniforms.particleVolume.value=field.volume
    material.uniforms.volumeDistanceScale.value=field.distanceScale
    material.uniforms.simulationMix.value=simulating?1:0
    material.uniforms.socialView.value=travel.chamber
    // Letters stay readable. The GitHub sculpture keeps the slow full rotation.
  },.16)
  return <mesh ref={plane} name="particle-social-target" position={[0,-9.785,0]} renderOrder={13} visible={false} onPointerMove={hover} onPointerOut={()=>{gl.domElement.style.cursor=''}} onClick={event=>{if(ringJourney(journey.current.value).contact<.1)return;event.stopPropagation();window.open(SOCIAL_LINKS[selected.current].href,'_blank','noopener,noreferrer')}}>
    <planeGeometry args={[.6,.72]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>
}
