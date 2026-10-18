'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import type { PolarAssets } from './assets'

export const progress = (time: number, start: number, duration: number) => THREE.MathUtils.clamp((time - start) / duration, 0, 1)
export const smooth = (value: number) => value * value * (3 - 2 * value)

export function Assembly({ assets, time }: { assets: PolarAssets; time: RefObject<number> }) {
  const materials = useMemo(() => {
    const wire = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { progress: { value: 0 }, alpha: { value: 0 }, time: { value: 0 } },
      vertexShader: `varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float progress;uniform float alpha;uniform float time;varying vec3 point;
        void main(){float scan=1.-smoothstep(progress*5.-.7,progress*5.,3.5-point.y);
          float flicker=.45+.55*sin(point.y*6.+time*5.)*sin(point.x*6.+time*5.);
          gl_FragColor=vec4(.65,.70,.84,alpha*scan*flicker);}`,
    })
    const cage = wire.clone()
    cage.vertexShader = `attribute vec3 centr;varying vec3 point;void main(){point=centr;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
    cage.fragmentShader = `uniform float progress;uniform float alpha;uniform float time;varying vec3 point;
      void main(){float wave=1.-smoothstep(1.,5.,abs(length(point)-progress*25.));
        float flicker=.5+.5*sin(point.x*13.+time*6.);
        gl_FragColor=vec4(.65,.70,.84,alpha*wave*flicker);}`
    const particles = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { atlas: { value: assets.numbers }, progress: { value: 0 }, alpha: { value: 0 }, height: { value: 800 } },
      vertexShader: `uniform float height;varying vec3 point;void main(){point=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=height/100.;}`,
      fragmentShader: `uniform sampler2D atlas;uniform float progress;uniform float alpha;varying vec3 point;
        void main(){float radius=length(point);vec2 uv=vec2(gl_PointCoord.x,(1.-gl_PointCoord.y)/32.);
          uv.y+=clamp(floor(progress*48.-radius),0.,30.)/32.;
          float wave=1.-smoothstep(1.,5.,abs(radius-progress*25.));
          float number=texture2D(atlas,uv).r;
          gl_FragColor=vec4(vec3(.8,.85,1.),number*wave*alpha*.5);}`,
    })
    return { wire, cage, particles }
  }, [assets])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  useFrame(({ size, gl }) => {
    const t = time.current
    materials.wire.uniforms.progress.value = smooth(progress(t, 0, 2.5))
    materials.wire.uniforms.alpha.value = 1 - smooth(progress(t, 2, 3))
    materials.wire.uniforms.time.value = t
    materials.cage.uniforms.progress.value = smooth(progress(t, 0, 4))
    materials.cage.uniforms.alpha.value = .4 * (1 - smooth(progress(t, 2.1, 3)))
    materials.cage.uniforms.time.value = t
    materials.particles.uniforms.progress.value = Math.sin(progress(t, .5, 4) * Math.PI / 2)
    materials.particles.uniforms.alpha.value = 1 - progress(t, 1.75, 2)
    materials.particles.uniforms.height.value = size.height * gl.getPixelRatio()
  })
  return <group name="assembly-introduction">
    <mesh geometry={assets.introCage} material={materials.cage} renderOrder={999} />
    <mesh geometry={assets.introOutline} material={materials.wire} renderOrder={999} />
    <points geometry={assets.introParticles} material={materials.particles} renderOrder={1000} />
  </group>
}
