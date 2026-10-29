'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import type { PolarAssets } from './assets'
import { landingPose } from './landing-motion'

export function Assembly({ assets, time }: { assets: PolarAssets; time: RefObject<number> }) {
  const materials = useMemo(() => {
    const wire = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { progress: { value: 0 }, alpha: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float progress;uniform float alpha;uniform float time;varying vec3 point;
        void main(){float edge=mix(5.5,.1,progress);float scan=smoothstep(edge-2.,edge,point.y);
          float flicker=(sin(point.y*6.+time*5.)*.5+.5)*(cos(point.z*6.+time*5.)*.5+.5)*(sin(point.x*6.+time*5.)*.5+.5);
          gl_FragColor=vec4(vec3(1.),alpha*scan*(flicker*.8+.2));}`,
    })
    const cage = wire.clone()
    cage.vertexShader = `attribute vec3 centr;attribute vec3 color;varying float seed;varying vec3 point;void main(){seed=color.r;point=centr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
    cage.fragmentShader = `uniform float progress;uniform float alpha;uniform float time;varying vec3 point;varying float seed;
      void main(){float wave=clamp((progress*25.-length(point))/5.,0.,1.);
        float flicker=.5+.5*sin(seed*13.+time*6.);
        gl_FragColor=vec4(vec3(1.),alpha*wave*flicker);}`
    const particles = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { atlas: { value: assets.numbers }, progress: { value: 0 }, alpha: { value: 0 }, height: { value: 800 } },
      vertexShader: `uniform float height;varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=height/100.;}`,
      fragmentShader: `uniform sampler2D atlas;uniform float progress;uniform float alpha;varying vec3 point;
        void main(){float radius=length(point);vec2 uv=vec2(gl_PointCoord.x,(1.-gl_PointCoord.y)/32.);
          uv.y+=1./32.+clamp(floor(progress*48.-radius)/32.,0.,1.);
          float wave=clamp((progress*25.-radius)/5.,0.,1.);
          float number=texture2D(atlas,uv).r;
          gl_FragColor=vec4(vec3(1.),number*wave*alpha*.5);}`,
    })
    return { wire, cage, particles }
  }, [assets])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  useFrame(({ size, gl }) => {
    const t = time.current
    const pose = landingPose(t)
    materials.wire.uniforms.progress.value = pose.outlineReveal
    materials.wire.uniforms.alpha.value = pose.outlineAlpha
    materials.wire.uniforms.time.value = t
    materials.cage.uniforms.progress.value = pose.cageReveal
    materials.cage.uniforms.alpha.value = pose.cageAlpha
    materials.cage.uniforms.time.value = t
    materials.particles.uniforms.progress.value = pose.numbersReveal
    materials.particles.uniforms.alpha.value = pose.numbersAlpha
    materials.particles.uniforms.height.value = size.height * gl.getPixelRatio()
  })
  return <group name="assembly-introduction">
    {/* These Draco assets store pairs of line endpoints, not triangle faces. */}
    <lineSegments geometry={assets.introCage} material={materials.cage} renderOrder={999} />
    <lineSegments geometry={assets.introOutline} material={materials.wire} renderOrder={999} />
    <points geometry={assets.introParticles} material={materials.particles} renderOrder={1000} />
  </group>
}
