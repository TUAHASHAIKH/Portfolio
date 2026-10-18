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
      color: '#d6dfea', roughness: .65, roughnessMap: assets.roughness,
      normalMap: assets.normal, normalScale: new THREE.Vector2(1,1),
      envMap: assets.environment, envMapIntensity: .91, envMapRotation: new THREE.Euler(0,Math.PI,0),
      metalness: 0, transmission: .72, thickness: .65, ior: 1.18,
      clearcoat: .12, clearcoatRoughness: .35,
    })
    ice.onBeforeCompile = shader => {
      // Atmospheric frost softens the environment's black extremes in the reference.
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.rgb=mix(clamp(gl_FragColor.rgb,0.,1.),vec3(.42,.46,.54),.18);')
    }
    const core = new THREE.MeshBasicMaterial({ map: assets.coreMap })
    const background = new THREE.ShaderMaterial({
      transparent: true, depthTest: true, depthWrite: false,
      uniforms: { noise: { value: noise }, alpha: { value: 0 }, time: { value: 0 }, aspect: { value: 1 }, resolution: { value: new THREE.Vector2() }, scroll: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D noise;uniform float alpha;uniform float time;uniform float aspect;uniform vec2 resolution;uniform float scroll;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 uv=gl_FragCoord.xy/resolution*vec2(aspect,1.);
          float mist=texture2D(noise,uv*.8+vec2(-time*.018,-scroll*.12)).r;
          mist+=texture2D(noise,uv*.4+vec2(time*.012,-time*.007)).r;
          vec3 color=mix(vec3(.38,.42,.50),vec3(.63,.67,.75),clamp(mist*.65,0.,1.));
          vec2 grid=uv*42.;float id=hash(floor(grid));
          float dotMask=1.-smoothstep(.006,.025,length(fract(grid)-.5));
          color+=dotMask*(.1+.2*id)*(.65+.35*sin(time*.4+id*25.));
          color+=(hash(gl_FragCoord.xy)-.5)*.008;
          gl_FragColor=vec4(color,alpha);}`,
    })
    return { ice, core, background }
  }, [assets, noise])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  useFrame(({ camera, size, gl }, delta) => {
    const p = journey.current.value, reveal = ease(range(p, .48, .92))
    if (!reduced) time.current += Math.min(delta, .1)
    if (rig.current) {
      rig.current.visible = p > .4
      camera.getWorldDirection(direction)
      rig.current.position.copy(camera.position).addScaledVector(direction, 6.6)
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
    materials.background.uniforms.resolution.value.set(size.width*gl.getPixelRatio(),size.height*gl.getPixelRatio())
    materials.background.uniforms.scroll.value = p
  }, .1)
  return <group ref={rig} name="first-portfolio-crystal">
    <mesh position={[0,0,-4]} material={materials.background} renderOrder={7}><planeGeometry args={[40,30]} /></mesh>
    <group ref={crystal}>
      <mesh geometry={assets.geometry} material={materials.ice} renderOrder={12} />
      <mesh geometry={assets.core} material={materials.core} renderOrder={11} />
      <CrystalPlexus reduced={reduced} />
    </group>
  </group>
}

function CrystalPlexus({ reduced }: { reduced: boolean }) {
  const time = useRef(0)
  const resources = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18*3*2*3),3))
    const material = new THREE.LineBasicMaterial({ color: '#edf2ff', opacity: .24, transparent: true, depthWrite: false })
    const points = Array.from({length:18},(_,i)=>new THREE.Vector3())
    return { geometry, material, points }
  }, [])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame((_, delta) => {
    if (!reduced) time.current += Math.min(delta,.1)
    const { points, geometry } = resources
    points.forEach((point,index) => {
      const angle=index*2.39996+time.current*.08
      const y=THREE.MathUtils.euclideanModulo(index*.483+time.current*.07,3)-1.5
      point.set(Math.cos(angle)*1.05,y,Math.sin(angle)*.85)
    })
    const attribute=geometry.getAttribute('position') as THREE.BufferAttribute
    let vertex=0
    points.forEach((point,index) => {
      // Small crosshairs and nearby connections drift around the ice at a fixed cost.
      attribute.setXYZ(vertex++,point.x-.012,point.y,point.z)
      attribute.setXYZ(vertex++,point.x+.012,point.y,point.z)
      attribute.setXYZ(vertex++,point.x,point.y-.018,point.z)
      attribute.setXYZ(vertex++,point.x,point.y+.018,point.z)
      const next=points[(index+5)%points.length]
      if(point.distanceTo(next)<1.8){
        attribute.setXYZ(vertex++,point.x,point.y,point.z)
        attribute.setXYZ(vertex++,next.x,next.y,next.z)
      }
    })
    geometry.setDrawRange(0,vertex)
    attribute.needsUpdate=true
  })
  return <lineSegments geometry={resources.geometry} material={resources.material} frustumCulled={false} renderOrder={16} />
}

export function Crystal({ noise, journey, reduced }: { noise: THREE.Texture; journey: RefObject<Journey>; reduced: boolean }) {
  const { gl } = useThree()
  const [assets, setAssets] = useState<CrystalAssets | null>(null)
  useEffect(() => {
    let cancelled = false, loaded: CrystalAssets | null = null
    loadCrystalAssets(gl).then(result => {
      if (cancelled) result.dispose()
      else { loaded = result; setAssets(result); document.querySelector('#app')?.setAttribute('data-crystal-ready', 'true') }
    }).catch(error => { if (!cancelled) { console.error('Crystal:', error); document.querySelector('#app')?.setAttribute('data-crystal-error', 'true') } })
    return () => { cancelled = true; loaded?.dispose() }
  }, [gl])
  return assets && <CrystalView assets={assets} noise={noise} journey={journey} reduced={reduced} />
}
