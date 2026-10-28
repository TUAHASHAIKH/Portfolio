'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import { landingPose } from './landing-motion'
import { stepWind, WIND_COUNT } from './wind-motion'

export function Wind({ intro }: { intro: RefObject<number> }) {
  const resources = useMemo(() => {
    const plane=new THREE.PlaneGeometry(.075,.15)
    const geometry=new THREE.InstancedBufferGeometry()
    geometry.setIndex(plane.index!.clone())
    for(const [name,attribute] of Object.entries(plane.attributes))geometry.setAttribute(name,attribute.clone())
    plane.dispose();geometry.instanceCount=WIND_COUNT
    const positions=new Float32Array(WIND_COUNT*3),velocities=new Float32Array(WIND_COUNT*3),seeds=new Float32Array(WIND_COUNT),randoms=new Float32Array(WIND_COUNT*4)
    const random=(i:number)=>THREE.MathUtils.euclideanModulo(Math.sin(i*127.1+19.7)*43758.5453,1)
    for(let i=0;i<WIND_COUNT;i++){
      positions.set([random(i*8)*50-25,random(i*8+1)*20-10,random(i*8+2)*50-25],i*3)
      seeds[i]=random(i*8+3)
      for(let k=0;k<4;k++)randoms[i*4+k]=random(i*8+4+k)
    }
    const offset=new THREE.InstancedBufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('offset',offset);geometry.setAttribute('random',new THREE.InstancedBufferAttribute(randoms,4))
    const material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{time:{value:0},introAlpha:{value:0}},
      vertexShader:`uniform float time;attribute vec3 offset;attribute vec4 random;varying vec2 vUv;varying vec3 point;varying float depth;
        mat2 turn(float a){return mat2(cos(a),sin(a),-sin(a),cos(a));}
        void main(){vUv=uv;vec3 p=position*mix(.85,1.15,step(random.x,.5));
          p.xy=turn(time*mix(.75,1.25,random.z)+random.z*6.28318)*p.xy;
          p.zx=turn((random.x+random.y+random.z)*6.28318)*p.zx;
          p.yz=turn(random.x*6.28318)*p.yz;
          point=p+offset;vec4 view=modelViewMatrix*vec4(point,1.);depth=length(view.xyz);
          gl_Position=projectionMatrix*view;}`,
      fragmentShader:`uniform float introAlpha;varying vec2 vUv;varying vec3 point;varying float depth;
        void main(){float radius=length(point);float alpha=(1.-min(25.,abs(point.x))/25.)*(1.-min(10.,abs(point.y))/10.)*(1.-min(25.,abs(point.z))/25.);
          alpha*=smoothstep(.5,1.,depth)*smoothstep(0.,2.,point.y)*smoothstep(.5,1.,min(6.,radius)/6.);
          alpha*=max(0.,1.-length(vUv-.5)*2.)*introAlpha;
          gl_FragColor=vec4(vec3(mix(.75,1.,1.-min(10.,radius)/10.)),clamp(alpha,0.,1.));}`,
    })
    return {geometry,material,positions,velocities,seeds,offset,time:0,accumulator:0}
  }, [])
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose()},[resources])
  useFrame((_,delta)=>{
    resources.accumulator+=Math.min(delta,.05)
    while(resources.accumulator>=1/60){resources.time+=1/60;stepWind(resources.positions,resources.velocities,resources.seeds,resources.time);resources.accumulator-=1/60}
    resources.offset.needsUpdate=true
    resources.material.uniforms.time.value=resources.time
    resources.material.uniforms.introAlpha.value=landingPose(intro.current).snow
  })
  return <mesh name="directional-wind" geometry={resources.geometry} material={resources.material} frustumCulled={false} renderOrder={5}/>
}
