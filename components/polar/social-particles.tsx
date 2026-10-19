'use client'

import { useEffect,useMemo,useRef } from 'react'
import { useFrame,useThree,type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Journey } from './journey'
import { ringJourney } from './ring-journey'
import { ParticleSimulation } from './particle-simulation'
import { SOCIAL_LINKS,socialIndex } from './social-links'

export function SocialParticles({core,geometry,material,journey,reduced,virtual}:{core:React.RefObject<THREE.Points|null>;geometry:THREE.BufferGeometry;material:THREE.ShaderMaterial;journey:React.RefObject<Journey>;reduced:boolean;virtual:THREE.PerspectiveCamera}){
  const {gl}=useThree()
  const plane=useRef<THREE.Mesh>(null)
  const selected=useRef(0),active=useRef(false),wasReduced=useRef(reduced)
  const field=useMemo(()=>new ParticleSimulation(geometry),[geometry])
  const pointer=useMemo(()=>({brush:new THREE.Vector2(10,10),last:new THREE.Vector2(10,10),velocity:new THREE.Vector2(),point:new THREE.Vector3(),initialized:false}),[])
  const weights=useMemo(()=>new THREE.Vector4(1,0,0,0),[])
  const view=useMemo(()=>({matrix:new THREE.Matrix4(),rotation:new THREE.Matrix4(),basis:new THREE.Matrix3(),center:new THREE.Vector3(0,-9.785,0)}),[])
  useEffect(()=>{
    field.clear();material.uniforms.particlePositions.value=field.position
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
    event.stopPropagation();plane.current?.worldToLocal(pointer.point.copy(event.point))
    pointer.brush.set(pointer.point.x/.6+.5,pointer.point.y/.6+.5)
    if(!pointer.initialized){pointer.last.copy(pointer.brush);pointer.initialized=true}
    active.current=true
  }
  useFrame((_,delta)=>{
    const travel=ringJourney(journey.current.value),enabled=travel.contact>.05
    if(plane.current){plane.current.visible=enabled;plane.current.quaternion.copy(virtual.quaternion)}
    if(!enabled&&active.current)leave()
    const dt=Math.min(delta,.05)
    const shape=journey.current.value<6.35?0:selected.current
    if(core.current&&shape!==0)core.current.rotation.y=reduced?0:Math.sin(material.uniforms.time.value*.2)*.14
    for(let index=0;index<SOCIAL_LINKS.length;index++)weights.setComponent(index,reduced?Number(index===shape):THREE.MathUtils.damp(weights.getComponent(index),Number(index===shape),9,dt))
    material.uniforms.socialWeights.value.copy(weights)
    if(wasReduced.current!==reduced){field.clear();wasReduced.current=reduced;active.current=false}
    const simulating=!reduced&&journey.current.value>5.9&&journey.current.value<9.8
    if(simulating){
      view.matrix.makeRotationFromQuaternion(virtual.quaternion).invert()
      if(core.current)view.rotation.makeRotationFromQuaternion(core.current.quaternion)
      view.matrix.multiply(view.rotation);view.basis.setFromMatrix4(view.matrix)
      field.orient(view.basis,virtual.position.distanceTo(view.center))
      pointer.velocity.subVectors(pointer.brush,pointer.last).divideScalar(Math.max(dt,.001)).clampLength(0,4)
      field.update(gl,dt,weights,pointer.brush,pointer.last,pointer.velocity,active.current&&enabled)
      pointer.last.copy(pointer.brush)
    }else field.clear()
    material.uniforms.particlePositions.value=field.position
    material.uniforms.simulationMix.value=simulating?1:0
    material.uniforms.socialView.value=travel.chamber
    // Letters stay readable. The GitHub sculpture keeps the slow full rotation.
  },.16)
  return <mesh ref={plane} name="particle-social-target" position={[0,-9.785,0]} renderOrder={13} visible={false} onPointerMove={move} onPointerOut={leave} onClick={event=>{if(ringJourney(journey.current.value).contact<.1)return;event.stopPropagation();window.open(SOCIAL_LINKS[selected.current].href,'_blank','noopener,noreferrer')}}>
    <planeGeometry args={[.6,.72]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>
}
