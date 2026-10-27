'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { loadPolarAssets, type PolarAssets } from './assets'
import { liftLandscape, makeIceMaterial, makeTerrainMaterial, surfaceVertex } from './materials'
import { Measurements } from './measurements'
import { Wind, ForegroundWind } from './wind'
import { Assembly, progress, smooth } from './assembly'
import { Crystal } from './crystal'
import { Rings } from './rings'
import { ringJourney } from './ring-journey'
import { advanceJourney, forwardAtBoundary, reverseAtBoundary } from './journey-motion'
import { portfolioAudio } from './audio-engine'
import { ease, range, returnProgress, returnChoreography, landscapeTravel, journeyView, crystalJourney, crystalCenter, isCrystalKind, CRYSTAL_KINDS, JOURNEY_END, type Journey } from './journey'

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

function PostProcessing({ assets, journey, reduced }: { assets: PolarAssets; journey: React.RefObject<Journey>; reduced: boolean }) {
  const { gl, scene, camera, size } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    const render = new RenderPass(scene, camera)
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, grade: { value: assets.grade }, crystalGrade: { value: assets.grade }, crystalMix: { value: 0 }, ringMix: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform highp sampler3D grade;
        uniform highp sampler3D crystalGrade;
        uniform float crystalMix;
        uniform float ringMix;
        varying vec2 vUv;
        vec3 lookup(vec3 point){return mix(texture(grade,(point+.5)/32.).rgb,texture(crystalGrade,(point+.5)/32.).rgb,crystalMix);}
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
          vec3 original = texture2D(tDiffuse,vUv).rgb;
          vec3 color = clamp(original,0.,1.);
          color = mix(color*12.92,1.055*pow(color,vec3(1./2.4))-.055,step(vec3(.0031308),color));
          color = interpolateGrade(color);
          color = mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));
          gl_FragColor=vec4(mix(color,original,ringMix),1.);
        }
      `,
    })
    // Grade in display space, bloom in linear light, then convert once for the screen.
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), .14, .55, .9)
    const distortion = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: 0 }, curtain: { value: 0 }, resolution: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D tDiffuse;uniform float amount;uniform float curtain;uniform vec2 resolution;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 uv=vUv, direction=uv-vec2(.5,.49);
          float intensity=amount*(curtain>0.?1.-smoothstep(.03,.45,abs(uv.y-curtain)):1.);
          float tile=hash(floor(uv*vec2(140.,85.)));
          uv+=direction*tile*intensity*.018;
          vec3 color=vec3(0.);
          for(int i=0;i<8;i++){vec2 sampleUv=uv-direction*float(i)*intensity*.008;
            vec2 split=direction*intensity*.008;
            color+=vec3(texture2D(tDiffuse,sampleUv+split).r,texture2D(tDiffuse,sampleUv).g,texture2D(tDiffuse,sampleUv-split).b)/8.;}
          color=mix(color,vec3(.36,.39,.46),intensity*.14);
          gl_FragColor=vec4(color,1.);}`,
    })
    const frost = new ShaderPass({
      uniforms:{tDiffuse:{value:null},blue:{value:assets.wind},squares:{value:assets.wind},amount:{value:0},time:{value:0},opacity:{value:0},resolution:{value:new THREE.Vector2()}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:`uniform sampler2D tDiffuse;uniform sampler2D blue;uniform sampler2D squares;uniform float amount;uniform float time;uniform float opacity;uniform vec2 resolution;varying vec2 vUv;
        void main(){vec2 p=vUv-.5;p.x*=resolution.x/resolution.y;
          float grain=texture2D(blue,gl_FragCoord.xy/128.+fract(time*.13)).r;float angle=(grain-.5)*.3*amount;
          p=mat2(cos(angle),sin(angle),-sin(angle),cos(angle))*p;
          p.x/=resolution.x/resolution.y;vec2 uv=p+.5;
          float tile=texture2D(squares,vUv*2.+floor(time*.7)*.13).g;uv+=(tile-.5)*amount*.014;
          vec2 split=(uv-.5)*amount*.006;
          vec3 color=vec3(texture2D(tDiffuse,uv+split).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-split).b);
          float glare=pow(vUv.x*vUv.y,2.)*(sin(vUv.x*3.+vUv.y*2.+time*.2)*.4+.4);
          color+=vec3(.8,.9,1.)*glare*grain*.35*opacity;
          color+=(grain-.5)*.006*opacity;gl_FragColor=vec4(color,1.);}`,
    })
    const output = new OutputPass()
    composer.addPass(render); composer.addPass(grade); composer.addPass(bloom); composer.addPass(distortion); composer.addPass(frost); composer.addPass(output)
    return { composer, render, grade, bloom, distortion, frost, output }
  }, [gl, scene, camera, assets.grade])
  useEffect(() => { pipeline.composer.setSize(size.width, size.height) }, [pipeline, size])
  useEffect(() => {
    // This pass starts disabled. Prepare it now instead of compiling at the
    // first wheel event, when the frame budget is needed for the transition.
    const warmScene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)
    const target = new THREE.WebGLRenderTarget(16,16)
    const camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1)
    let cancelled = false
    warmScene.add(new THREE.Mesh(geometry, pipeline.distortion.material))
    warmScene.add(new THREE.Mesh(geometry, pipeline.frost.material))
    void gl.compileAsync(warmScene, camera).then(() => {
      if (cancelled) return
      const previous = gl.getRenderTarget()
      try { gl.setRenderTarget(target); gl.render(warmScene, camera) }
      finally { gl.setRenderTarget(previous); target.dispose() }
    })
      .catch(error => console.error('Transition shader preparation:', error))
    return () => { cancelled = true; geometry.dispose(); target.dispose() }
  }, [gl, pipeline])
  useEffect(() => () => { pipeline.render.dispose(); pipeline.grade.dispose(); pipeline.bloom.dispose(); pipeline.distortion.dispose(); pipeline.frost.dispose(); pipeline.output.dispose(); pipeline.composer.dispose() }, [pipeline])
  useFrame((_, delta) => {
    const p = journey.current.value
    pipeline.grade.uniforms.crystalGrade.value = scene.userData.crystalGrade || assets.grade
    pipeline.grade.uniforms.crystalMix.value = ease(range(p, .4, .9))*(1-ease(range(p,8.6,9.8)))
    const rings = Number(scene.userData.ringOpacity || 0)
    const ringTone=rings*(1-ease(range(p,8.6,9.6)))
    pipeline.grade.uniforms.ringMix.value = ringTone
    pipeline.bloom.strength = THREE.MathUtils.lerp(.14,.7,ringTone)
    pipeline.bloom.threshold = THREE.MathUtils.lerp(.9,.65,ringTone)
    pipeline.bloom.radius = THREE.MathUtils.lerp(.55,.85,ringTone)
    pipeline.frost.enabled = rings > .001
    pipeline.frost.uniforms.amount.value = reduced ? 0 : Number(scene.userData.ringProximity || 0)
    pipeline.frost.uniforms.opacity.value = rings
    pipeline.frost.uniforms.blue.value = scene.userData.ringBlue || assets.wind
    pipeline.frost.uniforms.squares.value = scene.userData.ringScroll || assets.wind
    if(!reduced)pipeline.frost.uniforms.time.value += Math.min(delta,.1)
    pipeline.frost.uniforms.resolution.value.set(size.width,size.height)
    const strength = journeyView(p).distortion
    pipeline.distortion.uniforms.amount.value = reduced ? 0 : strength
    pipeline.distortion.uniforms.curtain.value = returnProgress(p)
    pipeline.distortion.enabled = !reduced && strength > .001
    pipeline.composer.render(delta)
  }, 1)
  return null
}

function Ice({ assets, cursor, engaged, reduced, intro, journey, lift }: { assets: PolarAssets; cursor: THREE.Vector3; engaged: React.RefObject<boolean>; reduced: boolean; intro: React.RefObject<number>; journey: React.RefObject<Journey>; lift: { value: number } }) {
  const idle=useRef(0)
  const outline=useRef<THREE.MeshBasicMaterial>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const resources = useMemo(() => assets.pieces.map(piece => {
    const material = makeIceMaterial(assets)
    material.uniforms.center.value.copy(piece.center)
    return { ...piece, material, motion: { fast: 0, slow: 0 } as Motion, point: piece.center.clone() }
  }), [assets])
  useEffect(() => () => { resources.forEach(piece => piece.material.dispose()) }, [resources])
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, .25)
    if(!reduced)idle.current+=delta
    const p=journey.current.value
    const returning=returnChoreography(p)
    const hero=p>8.6?returnProgress(p):1-ease(range(p,.03,.65))
    const arrival=ease(range(intro.current,1.7,3.3))
    if(outline.current)outline.current.opacity=p>8.6&&!reduced?returning.scatter*returning.arrival*.32:0
    resources.forEach((piece, index) => {
      const mesh = meshes.current[index]
      if (!mesh) return
      const distance = piece.center.distanceTo(cursor)
      const influence = 1 - THREE.MathUtils.smoothstep(distance, 1, 3)
      const anchored = THREE.MathUtils.smoothstep(piece.center.y, .45, .7)
      // The visible hero always breathes open, including a fresh load with no
      // wheel or pointer input. Hover adds a local response to that idle motion.
      const front=THREE.MathUtils.smoothstep(piece.center.z-piece.center.x,-2,2)
      const breathing=.16*(.7+.3*Math.sin(idle.current*.85+piece.seed.y*2.))*(.35+.65*front)
      const hover=engaged.current?influence*.54:0
      const target = reduced?0:Math.max(breathing,hover)*anchored*hero*arrival
      // Preserve the reference's two-stage easing without the previous extra slowdown.
      piece.motion.fast = reduced?0:THREE.MathUtils.damp(piece.motion.fast, target, blockResponse, delta)
      piece.motion.slow = reduced?0:THREE.MathUtils.damp(piece.motion.slow, piece.motion.fast, blockResponse, delta)
      // Assembly is scroll-driven, so reversal retraces the same loose pieces
      // without waiting for the hover spring or replaying an intro timer.
      const assembly=p>8.6&&!reduced?returning.scatter*anchored*(.5+piece.seed.y*.15):0
      const amount = piece.motion.slow+assembly
      mesh.position.copy(piece.center).addScaledVector(piece.center, amount)
      mesh.rotation.set(
        Math.cos(piece.seed.y * 30 + amount * 2) * amount * .5,
        Math.cos(piece.seed.z * 30 + amount * 2) * amount * .5,
        Math.cos(piece.seed.x * 30 + amount * 2) * amount * .5,
      )
      piece.material.uniforms.materialize.value = reduced ? 1 : smooth(progress(intro.current, 1.1, 2.25))
      piece.material.uniforms.separation.value = amount
      piece.point.copy(mesh.position)
    })
  })
  return <group name="living-igloo">
    <mesh geometry={assets.introOutline} renderOrder={5} raycast={()=>{}}>
      <meshBasicMaterial ref={outline} transparent opacity={0} color="#dceaff" depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
    {resources.map((piece, index) => <mesh key={index} ref={mesh => { meshes.current[index] = mesh }} geometry={piece.geometry} material={piece.material} position={piece.center} renderOrder={4} />)}
    <Measurements pieces={resources} cursor={cursor} reduced={reduced} lift={lift} />
  </group>
}

function World({ assets, onReady, reduced, journey }: { assets: PolarAssets; onReady: () => void; reduced: boolean; journey: React.RefObject<Journey> }) {
  const { gl, camera, size } = useThree()
  const pointer = useMemo(() => new THREE.Vector2(), [])
  const landscape = useRef<THREE.Group>(null)
  const lift = useMemo(()=>({ value: 0 }),[])
  const rayPointer = useMemo(()=>new THREE.Vector2(),[])
  const retreat = useMemo(() => new THREE.Vector3(), [])
  const orbit = useRef({ yaw: 0, pitch: 0 })
  const cameraTarget = useMemo(() => new THREE.Vector3(0, 1.6, 0), [])
  const cameraOffset = useMemo(() => new THREE.Vector3(), [])
  const cameraRight = useMemo(() => new THREE.Vector3(), [])
  const cameraUp = useMemo(() => new THREE.Vector3(), [])
  const worldUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const engaged = useRef(false)
  const windTime = useRef(0)
  const introTime = useRef(-.7)
  const [assembling, setAssembling] = useState(!reduced)
  const introCamera = useMemo(() => new THREE.Vector3(), [])
  const introTarget = useMemo(() => new THREE.Vector3(), [])
  const cursor = useMemo(() => new THREE.Vector3(0, 2, 0), [])
  const target = useMemo(() => new THREE.Vector3(), [])
  const plane = useMemo(() => new THREE.Plane(), [])
  const normal = useMemo(() => new THREE.Vector3(), [])
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const surfaces = useMemo(() => ({
    ground: makeTerrainMaterial(assets.groundMap, { glow: assets.glow, wind: assets.wind }),
    mountain: makeTerrainMaterial(assets.mountainMap, { mountain: true }),
    terrain: makeTerrainMaterial(assets.terrainMap, { wind: assets.wind }),
    patch: makeTerrainMaterial(assets.terrainMap, { patch: true, wind: assets.wind }),
    haze: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { noise: { value: assets.wind }, time: { value: 0 } },
      vertexShader: surfaceVertex,
      fragmentShader: `
        uniform sampler2D noise;
        uniform float time;
        varying vec2 surfaceUv;
        varying vec3 worldPoint;
        void main(){
          vec2 uv=surfaceUv*vec2(2.,1.);
          float phase=worldPoint.x > 6. ? .914 : 0.;
          vec2 drift=vec2(-time*.15-phase,time*.06);
          float wisps=texture2D(noise,uv+drift).r*texture2D(noise,uv*1.25+vec2(drift.x,.75)).r;
          wisps*=texture2D(noise,uv*.5+vec2(drift.x,-time*.0525)).r;
          float edge=smoothstep(0.,.5,surfaceUv.x)*(1.-smoothstep(.8,1.,surfaceUv.x));
          float veil=wisps*edge*smoothstep(0.,.1,surfaceUv.y)*(1.-surfaceUv.y)*6.;
          gl_FragColor=vec4(vec3(.86,.88,.92),min(veil,.45));
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
  useEffect(()=>{
    const seen=new Set<THREE.Material>()
    landscape.current?.traverse(object=>{
      const mesh=object as THREE.Mesh
      if(!mesh.material||object.name==='landscape-sky')return
      // GPU displacement must not be culled using the unshifted CPU bounds.
      mesh.frustumCulled=false
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(seen.has(material))continue
        seen.add(material)
        liftLandscape(material,lift)
        material.needsUpdate=true
      }
    })
  },[assets,lift,surfaces])
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
  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, .25), mobile = size.width < 700
    const p = journey.current.value
    lift.value=reduced?0:landscapeTravel(p)
    if (landscape.current) {
      landscape.current.visible = p < .94 || p > 8.6 || gl.domElement.closest('#app')?.getAttribute('data-crystal-ready') !== 'true'
      landscape.current.position.y = 0
    }
    const distance = mobile ? 1.65 : 1
    // Reference: ±pi/2 pointer mapping, .07/.025 angular gain and .035/frame easing.
    const orbitResponse = -60 * Math.log(1 - .035)
    orbit.current.yaw = reduced?0:THREE.MathUtils.damp(orbit.current.yaw, pointer.x * Math.PI / 2 * .07, orbitResponse, delta)
    orbit.current.pitch = reduced?0:THREE.MathUtils.damp(orbit.current.pitch, -pointer.y * Math.PI / 2 * .025, orbitResponse, delta)
    cameraOffset.set(-14 * distance, 4 * distance, 14 * distance).sub(cameraTarget)
    normal.copy(cameraOffset).normalize()
    cameraRight.crossVectors(worldUp, normal).normalize()
    cameraUp.crossVectors(normal, cameraRight).normalize()
    cameraOffset.applyAxisAngle(cameraRight, orbit.current.pitch).applyAxisAngle(cameraUp, orbit.current.yaw)
    introTime.current = reduced ? 9 : Math.min(9, introTime.current + frameDelta)
    if (assembling && introTime.current >= 5.2) setAssembling(false)
    const arrival = smooth(progress(introTime.current, 2, 5.5))
    introCamera.set(-14 * distance, 21 * distance, 14 * distance)
    camera.position.copy(cameraTarget).add(cameraOffset).lerp(introCamera, 1 - arrival)
    introTarget.set(0, .5, 0).lerp(cameraTarget, arrival)
    retreat.set(-22 * distance, 7 * distance, 37 * distance)
    camera.position.lerp(retreat, journeyView(p).zoom)
    camera.lookAt(introTarget)
    for (const material of [surfaces.ground, surfaces.terrain, surfaces.patch, surfaces.mountain]) {
      material.uniforms.reveal.value = reduced ? 1 : smooth(progress(introTime.current, .7, 7.5))
    }
    const app = gl.domElement.closest('#app'), introduced = String(introTime.current >= 4.5)
    if (app?.getAttribute('data-introduced') !== introduced) app?.setAttribute('data-introduced', introduced)
    camera.getWorldDirection(normal)
    target.copy(camera.position).addScaledVector(normal, mobile ? 31.8 : 19.25)
    plane.setFromNormalAndCoplanarPoint(normal, target)
    rayPointer.copy(pointer);rayPointer.y-=lift.value
    ray.setFromCamera(rayPointer, camera)
    ray.ray.intersectPlane(plane, target)
    if(reduced)cursor.copy(target)
    else cursor.lerp(target, 1 - Math.exp(-pointerResponse * delta))
    const dpr = gl.getPixelRatio()
    if (!reduced) windTime.current += delta
    for (const material of Object.values(surfaces)) {
      material.uniforms.resolution?.value.set(size.width * dpr, size.height * dpr)
      if (material.uniforms.time) material.uniforms.time.value = windTime.current
    }
    surfaces.ground.uniforms.cursor.value.copy(cursor)
    surfaces.ground.uniforms.groundLight.value = reduced?.1:THREE.MathUtils.damp(surfaces.ground.uniforms.groundLight.value, engaged.current ? .8 : .1, 1.4, delta)
  },-1)
  return <>
    <group ref={landscape} name="polar-landscape">
    <mesh name="landscape-sky" material={surfaces.sky} renderOrder={-10}><sphereGeometry args={[700, 12, 12]} /></mesh>
    {mountains.map((item, index) => <mesh key={`mountain-${index}`} geometry={assets.mountain} material={surfaces.mountain} position={tuple(item.position)} scale={tuple(item.scale)} rotation={tuple(item.rotation.map(radians))} renderOrder={0} />)}
    {terrain.map((item, index) => <mesh key={`terrain-${index}`} geometry={assets.ground} material={surfaces.terrain} position={tuple(item.position)} scale={tuple(item.scale)} rotation={tuple(item.rotation.map(radians))} renderOrder={1} />)}
    <mesh geometry={assets.patch} material={surfaces.patch} position={[-9.34,-1.77,6.96]} scale={7} renderOrder={0} />
    <mesh geometry={assets.patch} material={surfaces.patch} position={[-8.82,-1.35,11.69]} scale={8} rotation={[radians(-5.5),radians(-25.6),0]} renderOrder={0} />
    <mesh geometry={assets.ground} material={surfaces.ground} renderOrder={2} />
    <mesh material={surfaces.haze} position={[-5,1.25,-10]} renderOrder={3}><planeGeometry args={[20,5]} /></mesh>
    <mesh material={surfaces.haze} position={[13.45,3,-4]} rotation={[0,radians(-10),0]} renderOrder={3}><planeGeometry args={[20,5]} /></mesh>
    <Ice assets={assets} cursor={cursor} engaged={engaged} reduced={reduced} intro={introTime} journey={journey} lift={lift} />
    {!reduced && assembling && <Assembly assets={assets} time={introTime} />}
    {!reduced && <Wind />}
    {!reduced && <ForegroundWind noise={assets.wind} intro={introTime} />}
    </group>
    <Crystal noise={assets.wind} journey={journey} reduced={reduced} />
    <Rings noise={assets.wind} journey={journey} reduced={reduced} />
    <PostProcessing assets={assets} journey={journey} reduced={reduced} />
  </>
}

function SceneController({ onReady, reduced, journey }: { onReady: () => void; reduced: boolean; journey: React.RefObject<Journey> }) {
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
  return assets && <World assets={assets} onReady={onReady} reduced={reduced} journey={journey} />
}

export default function App3D({ onReady, reducedMotion, journey }: { onReady: () => void; reducedMotion: boolean; journey: React.RefObject<Journey> }) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  return <Canvas dpr={[1,1.5]} camera={{ position: [-14,4,14], fov: 30, near: .1, far: 1000 }} gl={{ antialias: true, alpha: false, outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }} frameloop={visible ? 'always' : 'never'}>
    <JourneyMotion journey={journey} reduced={reducedMotion} />
    <SceneController onReady={onReady} reduced={reducedMotion} journey={journey} />
  </Canvas>
}

function JourneyMotion({ journey, reduced }: { journey: React.RefObject<Journey>; reduced: boolean }) {
  const { gl } = useThree()
  const motion = useRef({velocity:0})
  const overlay = useRef<HTMLElement | null>(null)
  const laps=useRef(0)
  const resumed=useRef(false)
  useEffect(()=>{
    const reset=()=>{motion.current.velocity=0}
    const visibility=()=>{resumed.current=true;reset()}
    window.addEventListener('portfolio:reset-motion',reset)
    document.addEventListener('visibilitychange',visibility)
    return()=>{
      window.removeEventListener('portfolio:reset-motion',reset)
      document.removeEventListener('visibilitychange',visibility)
    }
  },[])
  useFrame((_, delta) => {
    const state = journey.current
    const app = overlay.current ||= gl.domElement.closest('#app') as HTMLElement | null
    const detail = app?.dataset.detail
    // Scrolling a gallery or changing focus inside a native modal must never
    // move the sculpture behind it. The existing spring still eases to center.
    if (isCrystalKind(detail)) {
      state.target = crystalCenter(detail)
      delete state.reverseTarget
      delete state.forwardTarget
    }
    // Analytic critically damped spring: continuous velocity even when scrolling reverses.
    // The same trajectory drives retreat, curtain and crystal, without a stage switch.
    // The canvas pauses in background tabs. Do not integrate the time spent
    // hidden into a single visible camera step when it resumes.
    advanceJourney(state,motion.current,resumed.current?0:delta,reduced)
    resumed.current=false
    if(reverseAtBoundary(state,motion.current)){
      window.dispatchEvent(new CustomEvent('portfolio:journey-reversed',{detail:state.target}))
    }
    // Both ends render the same assembled hero. Rebase only at the matching
    // pose, retaining free native scrolling in either direction.
    if(forwardAtBoundary(state,motion.current)){
      laps.current++
      window.dispatchEvent(new CustomEvent('portfolio:journey-wrapped',{detail:state.target}))
    }
    portfolioAudio.update(state.value,delta)
    if (!app) return
    const hero = Math.max(1-ease(range(state.value,.02,.25)),ease(range(state.value,9.1,9.8))).toFixed(4)
    const crystal = (ease(range(state.value,.83,1))*(1-ease(range(state.value,8.8,9.8)))).toFixed(4)
    if(app.dataset.journeyLoops!==String(laps.current))app.dataset.journeyLoops=String(laps.current)
    const shards = crystalJourney(state.value)
    const contact=ringJourney(state.value).contact
    const contactOpacity=contact.toFixed(4),contactInteractive=String(contact>.05)
    if(app.style.getPropertyValue('--contact-opacity')!==contactOpacity)app.style.setProperty('--contact-opacity',contactOpacity)
    if(app.dataset.contactInteractive!==contactInteractive)app.dataset.contactInteractive=contactInteractive
    if (app.style.getPropertyValue('--hero-opacity') !== hero) app.style.setProperty('--hero-opacity', hero)
    if (app.style.getPropertyValue('--crystal-opacity') !== crystal) app.style.setProperty('--crystal-opacity', crystal)
    for (const kind of CRYSTAL_KINDS) {
      const property = `--${kind}-opacity`
      const formatted = shards[`${kind}Opacity`].toFixed(4)
      if (app.style.getPropertyValue(property) !== formatted) app.style.setProperty(property,formatted)
      const enabled = String(shards[`${kind}Interactive`] && shards[`${kind}Opacity`]>.05)
      if(app.dataset[`${kind}Interactive`]!==enabled)app.dataset[`${kind}Interactive`]=enabled
    }
    const active = shards.aboutInteractive ? 'about' : shards.projectsInteractive ? 'projects' : shards.skillsInteractive ? 'skills' : 'none'
    if (app.dataset.activeCrystal !== active) app.dataset.activeCrystal = active
    const stage = state.value>=9.8 ? 'igloo' : contact>.05 ? 'contact' : state.value > 3.3 ? 'rings' : state.value > .82 ? 'crystal' : state.value > .02 ? 'transition' : 'igloo'
    if (app.dataset.stage !== stage) app.dataset.stage = stage
  }, -2)
  return null
}
