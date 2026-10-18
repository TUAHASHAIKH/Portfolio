'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, type RefObject } from 'react'
import * as THREE from 'three'
import type { CrystalAssets } from './crystal-assets'

export type CrystalInteraction = { active: boolean; point: THREE.Vector3 }

export function CrystalFrost({ assets, interaction, reduced }: { assets: CrystalAssets; interaction: RefObject<CrystalInteraction>; reduced: boolean }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -1,
    uniforms: { triangles: { value: assets.triangles }, hit: { value: new THREE.Vector3() }, radius: { value: 0 }, strength: { value: 0 } },
    vertexShader: `varying vec3 point;varying vec2 surfaceUv;void main(){point=position;surfaceUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position+normal*.002,1.);}`,
    fragmentShader: `uniform sampler2D triangles;uniform vec3 hit;uniform float radius;uniform float strength;varying vec3 point;varying vec2 surfaceUv;
      void main(){float distanceFromCursor=distance(point,hit);
        float wave=exp(-pow((distanceFromCursor-radius)*9.,2.));
        float field=1.-smoothstep(max(0.,radius-.45),radius+.08,distanceFromCursor);
        float grid=texture2D(triangles,surfaceUv*9.).r;
        float alpha=(grid*field*.32+wave*.13)*strength;
        gl_FragColor=vec4(vec3(.45,.65,.92),alpha);}`,
  }), [assets])
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, delta) => {
    const target = interaction.current
    material.uniforms.hit.value.lerp(target.point, reduced ? 1 : 1-Math.exp(-8*delta))
    material.uniforms.strength.value = THREE.MathUtils.damp(material.uniforms.strength.value,target.active ? 1 : 0, target.active ? 5 : 2.5,Math.min(delta,.1))
    material.uniforms.radius.value = reduced ? .8 : THREE.MathUtils.damp(material.uniforms.radius.value,target.active ? 2.3 : 0, target.active ? 1.5 : 2,Math.min(delta,.1))
  })
  return <mesh name="crystal-hover-frost" geometry={assets.geometry} material={material} raycast={() => {}} renderOrder={14} />
}
