'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Sparkles } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { loadPolarAssets, type PolarAssets } from './assets'
import { makeIceMaterial, makeTerrainMaterial, surfaceVertex } from './materials'

type Motion = { fast: number; slow: number }
const radians = (degrees: number) => degrees * Math.PI / 180
// Convert the reference's 60 Hz interpolation coefficients into per-second rates.
const pointerResponse = -60 * Math.log(1 - .05)
const blockResponse = -60 * Math.log(1 - .06)
const mountains = [
  { position: [59.53,-1,-11.84], scale: [4,3.14,4], rotation: [4.1,-42.8,5] },
  { position: [1,-2.21,-23], scale: [2,2,2], rotation: [3.5,30,0] },
  { position: [75,0,-90], scale: [8,8,8], rotation: [3.2,-16.7,-2.6] },
  { position: [250,11.33,-133], scale: [10,10,10], rotation: [13.2,20,5] },
  { position: [-25.22,-1.59,-53.05], scale: [2.5,2.5,2.5], rotation: [3.5,25,0] },
]
const terrain = [
  { position: [-3.76,-.58,12.5], scale: [.6,.6,.6], rotation: [-5.1,0,0] },
  { position: [-17.63,-.01,2], scale: [1,1,1], rotation: [2.7,.8,0] },
  { position: [3.12,-.75,-1.02], scale: [1.5,.66,1.5], rotation: [0,0,0] },
  { position: [6,.16,15.78], scale: [1,1,1], rotation: [1.1,0,7] },
  { position: [16.06,.34,4], scale: [1,1,1], rotation: [0,0,0] },
]
const tuple = (values: number[]) => values as [number, number, number]

function PostProcessing({ assets }: { assets: PolarAssets }) {
  const { gl, scene, camera, size } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    const render = new RenderPass(scene, camera)
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, grade: { value: assets.grade } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform highp sampler3D grade;
        varying vec2 vUv;
        vec3 lookup(vec3 point){return texture(grade,(point+.5)/32.).rgb;}
        vec3 interpolateGrade(vec3 color){
          vec3 point=clamp(color,0.,1.)*31.;
          vec3 base=floor(point), weights=fract(point);
          mat3 axes=mat3(1.);
          float temporary;vec3 axis;
          if(weights.x<weights.y){temporary=weights.x;weights.x=weights.y;weights.y=temporary;axis=axes[0];axes[0]=axes[1];axes[1]=axis;}
          if(weights.y<weights.z){temporary=weights.y;weights.y=weights.z;weights.z=temporary;axis=axes[1];axes[1]=axes[2];axes[2]=axis;}
          if(weights.x<weights.y){temporary=weights.x;weights.x=weights.y;weights.y=temporary;axis=axes[0];axes[0]=axes[1];axes[1]=axis;}
          return lookup(base)*(1.-weights.x)+lookup(base+axes[0])*(weights.x-weights.y)+lookup(base+axes[0]+axes[1])*(weights.y-weights.z)+lookup(base+1.)*weights.z;
        }
        void main(){
          vec3 color = clamp(texture2D(tDiffuse,vUv).rgb,0.,1.);
          color = mix(color*12.92,1.055*pow(color,vec3(1./2.4))-.055,step(vec3(.0031308),color));
          color = interpolateGrade(color);
          color = mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));
          gl_FragColor=vec4(color,1.);
        }
      `,
    })
    // Grade in display space, bloom in linear light, then convert once for the screen.
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), .42, .85, .72)
    const output = new OutputPass()
    composer.addPass(render); composer.addPass(grade); composer.addPass(bloom); composer.addPass(output)
    return { composer, render, grade, bloom, output }
  }, [gl, scene, camera, assets.grade])
  useEffect(() => { pipeline.composer.setSize(size.width, size.height) }, [pipeline, size])
  useEffect(() => () => { pipeline.render.dispose(); pipeline.grade.dispose(); pipeline.bloom.dispose(); pipeline.output.dispose(); pipeline.composer.dispose() }, [pipeline])
  useFrame((_, delta) => pipeline.composer.render(delta), 1)
  return null
}

function Ice({ assets, cursor, engaged, reduced }: { assets: PolarAssets; cursor: THREE.Vector3; engaged: React.RefObject<boolean>; reduced: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const labels = useRef<(HTMLDivElement | null)[]>([])
  const resources = useMemo(() => assets.pieces.map(piece => {
    const material = makeIceMaterial(assets)
    material.uniforms.center.value.copy(piece.center)
    return { ...piece, material, motion: { fast: 0, slow: 0 } as Motion, point: piece.center.clone() }
  }), [assets])
  const connections = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(48 * 6), 3)), [])
  const wires = useRef<THREE.LineSegments>(null)
  useEffect(() => () => { resources.forEach(piece => piece.material.dispose()); connections.dispose() }, [resources, connections])
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, .25)
    const visible: number[] = []
    resources.forEach((piece, index) => {
      const mesh = meshes.current[index]
      if (!mesh) return
      const distance = piece.center.distanceTo(cursor)
      const influence = 1 - THREE.MathUtils.smoothstep(distance, 1, 3)
      const anchored = THREE.MathUtils.smoothstep(piece.center.y, .45, .7)
      const target = !reduced && engaged.current ? influence * .54 * anchored : 0
      // Preserve the reference's two-stage easing without the previous extra slowdown.
      piece.motion.fast = THREE.MathUtils.damp(piece.motion.fast, target, blockResponse, delta)
      piece.motion.slow = THREE.MathUtils.damp(piece.motion.slow, piece.motion.fast, blockResponse, delta)
      const amount = piece.motion.slow
      mesh.position.copy(piece.center).addScaledVector(piece.center, amount)
      mesh.rotation.set(
        Math.cos(piece.seed.y * 30 + amount * 2) * amount * .5,
        Math.cos(piece.seed.z * 30 + amount * 2) * amount * .5,
        Math.cos(piece.seed.x * 30 + amount * 2) * amount * .5,
      )
      piece.material.uniforms.separation.value = amount
      piece.point.copy(mesh.position)
      // Reference measurements appear only on the opening side, away from the anchored base.
      const front = piece.center.x - piece.center.z < .8
      const alpha = front && index % 3 === 0 ? THREE.MathUtils.smoothstep(amount, .07, .23) : 0
      if (labels.current[index]) labels.current[index]!.style.opacity = String(alpha)
      if (alpha > .25) visible.push(index)
    })
    const positions = connections.getAttribute('position') as THREE.BufferAttribute
    let count = 0
    for (let i = 0; i < visible.length && count < 48; i++) {
      const start = resources[visible[i]].point
      let nearest = -1, distance = Infinity
      for (let j = i + 1; j < visible.length; j++) {
        const d = start.distanceToSquared(resources[visible[j]].point)
        if (d < distance && d < 5) { nearest = visible[j]; distance = d }
      }
      if (nearest >= 0) {
        const end = resources[nearest].point
        positions.setXYZ(count * 2, start.x, start.y, start.z)
        positions.setXYZ(count * 2 + 1, end.x, end.y, end.z)
        count++
      }
    }
    connections.setDrawRange(0, count * 2); positions.needsUpdate = true
    if (wires.current) wires.current.visible = count > 0
  })
  return <>
    {resources.map((piece, index) => <mesh key={index} ref={mesh => { meshes.current[index] = mesh }} geometry={piece.geometry} material={piece.material} position={piece.center}>
      {index % 3 === 0 && <Html center zIndexRange={[1, 0]} style={{ pointerEvents: 'none' }}><div className="block-label" ref={element => { labels.current[index] = element }} style={{ opacity: 0 }}>{String((index * 17 + 23) % 89).padStart(2, '0')}<span>+</span></div></Html>}
    </mesh>)}
    <lineSegments ref={wires} geometry={connections} visible={false} renderOrder={999}><lineBasicMaterial color="#ffffff" transparent opacity={.38} depthWrite={false} depthTest={false} /></lineSegments>
  </>
}

function World({ assets, onReady, reduced }: { assets: PolarAssets; onReady: () => void; reduced: boolean }) {
  const { gl, camera, size } = useThree()
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const orbit = useRef({ yaw: 0, pitch: 0 })
  const cameraTarget = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])
  const cameraOffset = useMemo(() => new THREE.Vector3(), [])
  const cameraRight = useMemo(() => new THREE.Vector3(), [])
  const cameraUp = useMemo(() => new THREE.Vector3(), [])
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const engaged = useRef(false)
  const cursor = useMemo(() => new THREE.Vector3(0, 2, 0), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const plane = useMemo(() => new THREE.Plane(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const surfaces = useMemo(() => ({
    ground: makeTerrainMaterial(assets.groundMap, { glow: assets.glow }),
    mountain: makeTerrainMaterial(assets.mountainMap, { mountain: true }),
    terrain: makeTerrainMaterial(assets.terrainMap),
    patch: makeTerrainMaterial(assets.terrainMap, { patch: true }),
    haze: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { noise: { value: assets.wind }, time: { value: 0 } },
      vertexShader: surfaceVertex,
      fragmentShader: `
        uniform sampler2D noise;
        uniform float time;
        varying vec2 surfaceUv;
        void main(){
          vec2 uv=surfaceUv*vec2(2.,1.);
          vec2 drift=vec2(-time*.035,time*.012);
          float wisps=texture2D(noise,uv+drift).r*texture2D(noise,uv*1.3+drift*.7).r;
          float edge=smoothstep(0.,.4,surfaceUv.x)*(1.-smoothstep(.7,1.,surfaceUv.x));
          float veil=wisps*edge*smoothstep(0.,.15,surfaceUv.y)*pow(1.-surfaceUv.y,2.)*.9;
          gl_FragColor=vec4(vec3(.86,.88,.92),veil);
        }
      `,
    }),
    sky: new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { resolution: { value: new THREE.Vector2(size.width, size.height) } },
      vertexShader: surfaceVertex,
      fragmentShader: 'uniform vec2 resolution;void main(){vec2 uv=gl_FragCoord.xy/resolution;float t=pow((uv.x+uv.y)*.5,2.);gl_FragColor=vec4(mix(vec3(.4287,.4678,.5711),vec3(.6376,.6724,.7682),t),1.);}',
    }),
  }), [assets])
  useEffect(() => {
    const move = (event: Event) => {
      const { clientX, clientY } = event as PointerEvent
      const bounds = gl.domElement.getBoundingClientRect()
      pointer.set(
        THREE.MathUtils.clamp((clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(1 - (clientY - bounds.top) / bounds.height * 2, -1, 1),
      )
      engaged.current = true
    }
    const leave = () => { engaged.current = false; pointer.set(0, 0) }
    // Include overlay areas: moving over the name must still move the landscape.
    const element = gl.domElement.closest('#app') || gl.domElement
    element.addEventListener('pointermove', move); element.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => { element.removeEventListener('pointermove', move); element.removeEventListener('pointerleave', leave); window.removeEventListener('blur', leave) }
  }, [gl, pointer])
  useEffect(() => { onReady() }, [onReady])
  useEffect(() => () => Object.values(surfaces).forEach(material => material.dispose()), [surfaces])
  useFrame(({ clock }, frameDelta) => {
    const delta = Math.min(frameDelta, .25), mobile = size.width < 700
    const distance = mobile ? 1.65 : 1
    // Reference: ±pi/2 pointer mapping, .07/.025 angular gain and .035/frame easing.
    const orbitResponse = -60 * Math.log(1 - .035)
    orbit.current.yaw = THREE.MathUtils.damp(orbit.current.yaw, reduced ? 0 : pointer.x * Math.PI / 2 * .07, orbitResponse, delta)
    orbit.current.pitch = THREE.MathUtils.damp(orbit.current.pitch, reduced ? 0 : -pointer.y * Math.PI / 2 * .025, orbitResponse, delta)
    cameraOffset.set(-14 * distance, 4 * distance, 14 * distance).sub(cameraTarget)
    normal.copy(cameraOffset).normalize()
    cameraRight.crossVectors(worldUp, normal).normalize()
    cameraUp.crossVectors(normal, cameraRight).normalize()
    cameraOffset.applyAxisAngle(cameraRight, orbit.current.pitch).applyAxisAngle(cameraUp, orbit.current.yaw)
    camera.position.copy(cameraTarget).add(cameraOffset)
    camera.lookAt(cameraTarget)
    camera.getWorldDirection(normal)
    target.copy(camera.position).addScaledVector(normal, mobile ? 31.8 : 19.25)
    plane.setFromNormalAndCoplanarPoint(normal, target)
    ray.setFromCamera(pointer, camera)
    ray.ray.intersectPlane(plane, target)
    cursor.lerp(target, 1 - Math.exp(-pointerResponse * delta))
    const dpr = gl.getPixelRatio()
    for (const material of Object.values(surfaces)) material.uniforms.resolution?.value.set(size.width * dpr, size.height * dpr)
    surfaces.ground.uniforms.cursor.value.copy(cursor)
    if (!reduced) surfaces.haze.uniforms.time.value = clock.elapsedTime
    surfaces.ground.uniforms.groundLight.value = THREE.MathUtils.damp(surfaces.ground.uniforms.groundLight.value, engaged.current && !reduced ? .8 : .1, 1.4, delta)
  })
  return <>
    <mesh material={surfaces.sky} renderOrder={-10}><sphereGeometry args={[700, 12, 12]} /></mesh>
    {mountains.map((item, index) => <mesh key={`mountain-${index}`} geometry={assets.mountain} material={surfaces.mountain} position={tuple(item.position)} scale={tuple(item.scale)} rotation={tuple(item.rotation.map(radians))} renderOrder={0} />)}
    {terrain.map((item, index) => <mesh key={`terrain-${index}`} geometry={assets.ground} material={surfaces.terrain} position={tuple(item.position)} scale={tuple(item.scale)} rotation={tuple(item.rotation.map(radians))} renderOrder={1} />)}
    <mesh geometry={assets.patch} material={surfaces.patch} position={[-9.34,-1.77,6.96]} scale={7} renderOrder={0} />
    <mesh geometry={assets.patch} material={surfaces.patch} position={[-8.82,-1.35,11.69]} scale={8} rotation={[radians(-5.5),radians(-25.6),0]} renderOrder={0} />
    <mesh geometry={assets.ground} material={surfaces.ground} renderOrder={2} />
    <mesh material={surfaces.haze} position={[-5,1.25,-10]} renderOrder={3}><planeGeometry args={[20,5]} /></mesh>
    <mesh material={surfaces.haze} position={[13.45,3,-4]} rotation={[0,radians(-10),0]} renderOrder={3}><planeGeometry args={[20,5]} /></mesh>
    <Ice assets={assets} cursor={cursor} engaged={engaged} reduced={reduced} />
    {!reduced && <Sparkles count={65} scale={[25,12,25]} position={[0,5,0]} size={1.1} speed={.08} opacity={.28} />}
    <PostProcessing assets={assets} />
  </>
}

function SceneController({ onReady, reduced }: { onReady: () => void; reduced: boolean }) {
  const { gl } = useThree()
  const [assets, setAssets] = useState<PolarAssets | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false, loaded: PolarAssets | null = null
    loadPolarAssets(gl).then(result => {
      if (cancelled) result.dispose()
      else { loaded = result; setAssets(result) }
    }).catch(error => { if (!cancelled) { console.error('Polar scene:', error); setFailed(true); onReady() } })
    return () => { cancelled = true; loaded?.dispose() }
  // Initialize the GPU assets once per renderer, independently of overlay state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl])
  if (failed) return <Html center><p className="scene-error">The landscape could not load. Please refresh.</p></Html>
  return assets && <World assets={assets} onReady={onReady} reduced={reduced} />
}

export default function App3D({ onReady, reducedMotion }: { onReady: () => void; reducedMotion: boolean }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <Canvas dpr={[1,1.5]} camera={{ position: [-14,4,14], fov: 30, near: .1, far: 1000 }} gl={{ antialias: true, alpha: false, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }} frameloop={visible ? 'always' : 'never'}>
    <SceneController onReady={onReady} reduced={reducedMotion} />
  </Canvas>
}
