'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { loadCrystalAssets, type CrystalAssets } from './crystal-assets'
import { ease, range, type Journey } from './journey'

function CrystalView({ assets, noise, journey, reduced }: { assets: CrystalAssets; noise: THREE.Texture; journey: RefObject<Journey>; reduced: boolean }) {
  const rig = useRef<THREE.Group>(null), crystal = useRef<THREE.Group>(null)
  const time = useRef(0)
  const direction = useMemo(() => new THREE.Vector3(), [])
  const materials = useMemo(() => {
    const ice = new THREE.MeshPhysicalMaterial({
      color: '#e0e8ef', roughness: .38, roughnessMap: assets.roughness,
      normalMap: assets.normal, normalScale: new THREE.Vector2(1,1),
      envMap: assets.environment, envMapIntensity: .91, envMapRotation: new THREE.Euler(0,Math.PI,0),
      metalness: .08, transmission: .72, thickness: .65, ior: 1.18,
      clearcoat: .28, clearcoatRoughness: .2,
    })
    const core = new THREE.MeshBasicMaterial({ map: assets.coreMap })
    const background = new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      uniforms: { noise: { value: noise }, alpha: { value: 0 }, time: { value: 0 }, aspect: { value: 1 }, scroll: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D noise;uniform float alpha;uniform float time;uniform float aspect;uniform float scroll;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 uv=vUv*vec2(aspect,1.);
          float mist=texture2D(noise,uv*.8+vec2(-time*.018,-scroll*.12)).r;
          mist+=texture2D(noise,uv*.4+vec2(time*.012,-time*.007)).r;
          vec3 color=mix(vec3(.28,.32,.40),vec3(.57,.61,.69),clamp(mist*.65,0.,1.));
          vec2 grid=uv*90.;float id=hash(floor(grid));
          float dotMask=1.-smoothstep(.015,.06,length(fract(grid)-.5));
          color+=dotMask*(.2+.5*id)*(.65+.35*sin(time*.4+id*25.));
          color+=(hash(gl_FragCoord.xy)-.5)*.008;
          gl_FragColor=vec4(color,alpha);}`,
    })
    return { ice, core, background }
  }, [assets, noise])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  useFrame(({ camera, size }, delta) => {
    const p = journey.current.value, reveal = ease(range(p, .48, .92))
    if (!reduced) time.current += Math.min(delta, .1)
    if (rig.current) {
      rig.current.visible = p > .4
      camera.getWorldDirection(direction)
      rig.current.position.copy(camera.position).addScaledVector(direction, 5.5)
      rig.current.quaternion.copy(camera.quaternion)
    }
    if (crystal.current) {
      crystal.current.visible = p > .62
      crystal.current.position.y = -2.8 * (1 - ease(range(p, .62, 1)))
      const turn = 1 - ease(range(p, .62, 1))
      crystal.current.rotation.set(turn * 1.6 + Math.sin(time.current*.3)*.055, turn*-2.2 + Math.sin(time.current*.24)*.09, turn*.7 + Math.sin(time.current*.28)*.04)
      crystal.current.scale.setScalar(size.width < 700 ? .68 : 1)
    }
    materials.background.uniforms.alpha.value = reveal
    materials.background.uniforms.time.value = time.current
    materials.background.uniforms.aspect.value = size.width/size.height
    materials.background.uniforms.scroll.value = p
  }, .1)
  return <group ref={rig} name="first-portfolio-crystal">
    <mesh position={[0,0,-4]} material={materials.background} renderOrder={7}><planeGeometry args={[40,30]} /></mesh>
    <group ref={crystal}>
      <mesh geometry={assets.geometry} material={materials.ice} renderOrder={12} />
      <mesh geometry={assets.core} material={materials.core} renderOrder={11} />
    </group>
  </group>
}

export function Crystal({ noise, journey, reduced }: { noise: THREE.Texture; journey: RefObject<Journey>; reduced: boolean }) {
  const { gl } = useThree()
  const [assets, setAssets] = useState<CrystalAssets | null>(null)
  useEffect(() => {
    let cancelled = false, loaded: CrystalAssets | null = null
    loadCrystalAssets(gl).then(result => {
      if (cancelled) result.dispose()
      else { loaded = result; setAssets(result) }
    }).catch(error => { if (!cancelled) { console.error('Crystal:', error); document.querySelector('#app')?.setAttribute('data-crystal-error', 'true') } })
    return () => { cancelled = true; loaded?.dispose() }
  }, [gl])
  return assets && <CrystalView assets={assets} noise={noise} journey={journey} reduced={reduced} />
}
