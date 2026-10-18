'use client'

import { MeshTransmissionMaterial, useFBO } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { loadCrystalAssets, type CrystalAssets } from './crystal-assets'
import { journeyView, type Journey } from './journey'
import { useCrystalFrost, type CrystalInteraction } from './crystal-frost'

function CrystalView({ assets, noise, journey, reduced }: { assets: CrystalAssets; noise: THREE.Texture; journey: RefObject<Journey>; reduced: boolean }) {
  const rig = useRef<THREE.Group>(null), crystal = useRef<THREE.Group>(null)
  const iceMesh = useRef<THREE.Mesh>(null)
  const { size, gl, scene } = useThree()
  const buffer = useFBO(Math.round(size.width * .75), Math.round(size.height * .75), { type: THREE.HalfFloatType })
  const backBuffer = useFBO(Math.round(size.width*.75),Math.round(size.height*.75),{type:THREE.HalfFloatType})
  const time = useRef(0)
  const direction = useMemo(() => new THREE.Vector3(), [])
  const interaction = useRef<CrystalInteraction>({ active: false, uv: new THREE.Vector2(.5,.5) })
  const frost = useCrystalFrost(assets,interaction,reduced)
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (journey.current.value < .9) return
    event.stopPropagation()
    if (event.uv1 && event.object === iceMesh.current) interaction.current.uv.copy(event.uv1)
    interaction.current.active = true
    gl.domElement.style.cursor = 'pointer'
  }
  const leave = () => { interaction.current.active = false; gl.domElement.style.cursor = '' }
  const explore = (event: ThreeEvent<MouseEvent>) => {
    if (journey.current.value < .9 || event.delta > 6) return
    event.stopPropagation()
    leave()
    window.dispatchEvent(new Event('portfolio:open-skills'))
  }
  useEffect(() => () => { gl.domElement.style.cursor = '' }, [gl])
  const prepareIce = useCallback((material: THREE.MeshPhysicalMaterial | null) => {
    if (!material || material.userData.atmosphericIce) return
    material.userData.atmosphericIce = true
    const compile = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer)
      shader.uniforms.surfaceFrost = frost
      shader.uniforms.frostTriangles = { value: assets.triangles }
      shader.vertexShader = 'attribute vec2 frostUv;varying vec2 vFrostUv;\n'+shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFrostUv=frostUv;')
      shader.fragmentShader = 'uniform sampler2D surfaceFrost;uniform sampler2D frostTriangles;varying vec2 vFrostUv;\n'+shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=1.-texture2D(surfaceFrost,vFrostUv).r*.95;')
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;mapN.xy*=1.-texture2D(surfaceFrost,vFrostUv).r;'))
      shader.fragmentShader = shader.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`vec2 field=texture2D(surfaceFrost,vFrostUv).rg;
        float grid=texture2D(frostTriangles,vNormalMapUv*9.).r;
        totalEmissiveRadiance+=vec3(.23,.36,.56)*field.g*2.+vec3(grid)*(field.g*10.+field.r*field.r);
        vec3 outgoingLight=totalDiffuse+totalSpecular+totalEmissiveRadiance;`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.rgb=mix(clamp(gl_FragColor.rgb,0.,1.),vec3(.42,.49,.60),.22);')
    }
    material.needsUpdate = true
  }, [assets,frost])
  const materials = useMemo(() => {
    const core = new THREE.MeshBasicMaterial({ map: assets.coreMap })
    const background = new THREE.ShaderMaterial({
      transparent: true, depthTest: true, depthWrite: false,
      uniforms: { noise: { value: assets.mist }, alpha: { value: 0 }, time: { value: 0 }, aspect: { value: 1 }, resolution: { value: new THREE.Vector2() }, scroll: { value: 0 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform sampler2D noise;uniform float alpha;uniform float time;uniform float aspect;uniform vec2 resolution;uniform float scroll;varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){vec2 uv=gl_FragCoord.xy/resolution*vec2(aspect,1.)*.3;
          float mist=texture2D(noise,uv+vec2(-time*.075,-scroll*.65+time*.01875)).r;
          mist+=texture2D(noise,uv*.5+vec2(time*.075,-time*.0375)).r;
          vec3 color=mix(vec3(.584,.631,.738),vec3(.089,.105,.147),clamp(mist*.5,0.,1.));
          color+=vec3(.085,.09,.1);
          vec2 grid=uv*140.;float id=hash(floor(grid));
          float dotMask=1.-smoothstep(.006,.025,length(fract(grid)-.5));
          color+=dotMask*(.1+.2*id)*(.65+.35*sin(time*.4+id*25.));
          color+=(hash(gl_FragCoord.xy)-.5)*.001;
          float curtain=smoothstep(0.,.6,alpha*1.6-(gl_FragCoord.y/resolution.y)*.7);
          gl_FragColor=vec4(color,curtain);}`,
    })
    return { core, background }
  }, [assets, noise])
  useEffect(() => { scene.userData.crystalGrade = assets.grade; return () => { delete scene.userData.crystalGrade } }, [scene, assets])
  useFrame(({ gl, scene, camera }) => {
    if (journeyView(journey.current.value).crystal <= 0 || !iceMesh.current) return
    const mesh=iceMesh.current, material=mesh.material as THREE.MeshPhysicalMaterial & { uniforms: Record<string,{value:unknown}> }
    const previous=gl.getRenderTarget(), alpha=materials.background.uniforms.alpha.value
    const resolution=materials.background.uniforms.resolution.value.clone()
    const landscape=scene.getObjectByName('polar-landscape'), visible=landscape?.visible
    const side=material.side
    mesh.visible=false
    if(landscape) landscape.visible=false
    materials.background.uniforms.alpha.value=1
    materials.background.uniforms.resolution.value.set(buffer.width,buffer.height)
    try {
      gl.setRenderTarget(backBuffer);gl.clear();gl.render(scene,camera)
      mesh.visible=true
      material.side=THREE.BackSide;material.needsUpdate=true
      material.uniforms.buffer.value=backBuffer.texture
      gl.setRenderTarget(buffer);gl.clear();gl.render(scene,camera)
    } finally {
      material.side=side;material.needsUpdate=true;material.uniforms.buffer.value=buffer.texture
      gl.setRenderTarget(previous);materials.background.uniforms.alpha.value=alpha
      materials.background.uniforms.resolution.value.copy(resolution);mesh.visible=true
      if(landscape) landscape.visible=Boolean(visible)
    }
  }, .2)
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  useFrame(({ camera, size, gl }, delta) => {
    if (journey.current.value < .9 && interaction.current.active) leave()
    const p = journey.current.value, travel = journeyView(p)
    if (!reduced) time.current += Math.min(delta, .1)
    if (rig.current) {
      rig.current.visible = p > .05
      camera.getWorldDirection(direction)
      rig.current.position.copy(camera.position).addScaledVector(direction, 6.6)
      rig.current.quaternion.copy(camera.quaternion)
    }
    if (crystal.current) {
      crystal.current.visible = travel.crystal > 0
      crystal.current.position.y = -3.2 * (1 - travel.crystal)
      const turn = 1 - travel.crystal
      crystal.current.rotation.set(turn * 1.6 + Math.sin(time.current*.3)*.055, turn*-2.2 + Math.sin(time.current*.24)*.09, turn*.7 + Math.sin(time.current*.28)*.04)
      crystal.current.scale.setScalar(size.width < 700 ? .68 : 1)
    }
    materials.background.uniforms.alpha.value = travel.mist
    materials.background.uniforms.time.value = time.current
    materials.background.uniforms.aspect.value = size.width/size.height
    materials.background.uniforms.resolution.value.set(size.width*gl.getPixelRatio(),size.height*gl.getPixelRatio())
    materials.background.uniforms.scroll.value = p
  }, .1)
  return <group ref={rig} name="first-portfolio-crystal">
    <mesh position={[0,0,-4]} material={materials.background} renderOrder={7}><planeGeometry args={[40,30]} /></mesh>
    <group ref={crystal} onPointerMove={move} onPointerOut={leave} onClick={explore}>
      <mesh ref={iceMesh} geometry={assets.geometry} renderOrder={12}>
        <MeshTransmissionMaterial ref={material => prepareIce(material as unknown as THREE.MeshPhysicalMaterial)} buffer={buffer.texture} samples={8} color="#e0e8ef" roughness={.65} roughnessMap={assets.roughness} normalMap={assets.normal} normalScale={new THREE.Vector2(1,1)} envMap={assets.environment} envMapIntensity={.91} envMapRotation={new THREE.Euler(0,Math.PI,0)} ior={1.18} reflectivity={.3} thickness={2} transmission={1} chromaticAberration={.1} anisotropicBlur={0} temporalDistortion={0} />
      </mesh>
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
  return <lineSegments geometry={resources.geometry} material={resources.material} frustumCulled={false} raycast={() => {}} renderOrder={16} />
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

