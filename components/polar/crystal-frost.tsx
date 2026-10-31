'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { compileForTarget } from './shader-preparation'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import type { CrystalAssets } from './crystal-assets'

export type CrystalInteraction = { active: boolean; uv: THREE.Vector2 }

/** A moving pointer thaws the ice and lights the advancing edge in its surface atlas. */
export function useCrystalFrost(assets: CrystalAssets, interaction: RefObject<CrystalInteraction>, reduced: boolean) {
  const { gl } = useThree()
  const motion = useRef({ previous: new THREE.Vector2(), velocity: 0, radius: 0, entered: false, idle: 10 })
  const simulation = useMemo(() => {
    const first = new THREE.WebGLRenderTarget(512,512,{type:THREE.HalfFloatType,depthBuffer:false})
    const second = first.clone()
    const material = new THREE.ShaderMaterial({
      depthTest:false,depthWrite:false,
      uniforms:{ previous:{value:first.texture}, advect:{value:assets.advect}, point:{value:new THREE.Vector2()}, lastPoint:{value:new THREE.Vector2()}, radius:{value:0}, step:{value:1} },
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D previous;uniform sampler2D advect;uniform vec2 point;uniform vec2 lastPoint;uniform float radius;uniform float step;varying vec2 vUv;
        float segment(vec2 p,vec2 a,vec2 b){vec2 line=b-a;float t=clamp(dot(p-a,line)/max(dot(line,line),1e-8),0.,1.);return length(p-a-line*t);}
        void main(){vec2 offset=vec2(1./512.)*step;
          vec2 uv=vUv+(texture2D(advect,vUv*3.).rg*2.-1.)*offset;
          float old=texture2D(previous,uv).r;
          float next=max(max(texture2D(previous,uv+vec2(offset.x,0.)).r,texture2D(previous,uv-vec2(offset.x,0.)).r),max(texture2D(previous,uv+vec2(0.,offset.y)).r,texture2D(previous,uv-vec2(0.,offset.y)).r));
          float splat=radius>0. ? pow(clamp(1.-segment(vUv,lastPoint,point)/radius,0.,1.),3.) : 0.;
          next=min((next+splat)*pow(.985,step),1.);
          gl_FragColor=vec4(next,max(next-old,0.),0.,1.);}`,
    })
    return { first,second,current:first,material,quad:new FullScreenQuad(material),field:{value:first.texture},users:0 }
  }, [assets])
  useEffect(() => {
    simulation.users++
    const previous=gl.getRenderTarget(), clear=gl.getClearColor(new THREE.Color()), alpha=gl.getClearAlpha()
    gl.setClearColor(0,0)
    for(const target of [simulation.first,simulation.second]){gl.setRenderTarget(target);gl.clear()}
    gl.setRenderTarget(previous);gl.setClearColor(clear,alpha)
    // Compile and upload the feedback pass during loading. Previously its first
    // draw happened under the cursor on the first crystal, stalling that frame.
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1)
    const geometry=new THREE.PlaneGeometry(2,2)
    const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false})
    scene.add(new THREE.Mesh(geometry,simulation.material))
    let cancelled=false
    const preparation=compileForTarget(gl,scene,camera,target).then(()=>{
      if(cancelled)return
      const saved=gl.getRenderTarget()
      try{gl.setRenderTarget(target);simulation.quad.render(gl)}
      finally{gl.setRenderTarget(saved);geometry.dispose();target.dispose()}
    }).catch(error=>{if(!cancelled)console.error('Crystal hover preparation:',error)})
    return () => {
      cancelled=true;simulation.users--
      void preparation.then(()=>{
        geometry.dispose();target.dispose()
        if(simulation.users===0){simulation.first.dispose();simulation.second.dispose();simulation.material.dispose();simulation.quad.dispose()}
      })
    }
  }, [gl,simulation])
  useFrame((_,delta) => {
    const state=interaction.current, movement=motion.current
    movement.idle=state.active?0:movement.idle+delta
    // The targets start clear. Skip the feedback draw until a pointer touches
    // the crystal, and sleep again once its visible afterglow has dissipated.
    if(movement.idle>=10){
      movement.previous.copy(state.uv);movement.entered=false;movement.velocity=0;movement.radius=0
      return
    }
    const distance=state.uv.distanceTo(movement.previous)
    if(state.active&&!movement.entered){movement.previous.copy(state.uv);movement.velocity=.35}
    movement.entered=state.active
    const step=Math.min(delta*60,2)
    movement.velocity=THREE.MathUtils.clamp((movement.velocity+(state.active&&distance<.3?distance*6:0))*Math.pow(.88,step),0,1)
    movement.radius=THREE.MathUtils.damp(movement.radius,state.active?movement.velocity:0,6,Math.min(delta,.1))
    simulation.material.uniforms.point.value.copy(state.uv)
    simulation.material.uniforms.lastPoint.value.copy(distance<.3?movement.previous:state.uv)
    simulation.material.uniforms.radius.value=state.active ? .05*THREE.MathUtils.smoothstep(movement.radius,.03,.6) : 0
    simulation.material.uniforms.step.value=reduced?0:step
    movement.previous.copy(state.uv)
    const previous=gl.getRenderTarget(), destination=simulation.current===simulation.first?simulation.second:simulation.first
    simulation.material.uniforms.previous.value=simulation.current.texture
    try {gl.setRenderTarget(destination);simulation.quad.render(gl)} finally {gl.setRenderTarget(previous)}
    simulation.current=destination
    simulation.field.value=destination.texture
  }, .05)
  return simulation.field
}
