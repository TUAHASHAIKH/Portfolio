'use client'

import { MeshTransmissionMaterial, useFBO } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { createRef, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { loadCrystalAssets, type CrystalAssets } from './crystal-assets'
import { CRYSTAL_KINDS, crystalJourney, crystalPose, journeyView, type Journey } from './journey'
import { useCrystalFrost, type CrystalInteraction } from './crystal-frost'
import { CrystalPlexus } from './crystal-plexus'
import { CrystalAnnotations } from './crystal-annotations'
import { detailPose } from './detail-motion'
import { portfolioAudio } from './audio-engine'

function CrystalView({ assets, noise, journey, reduced }: { assets: CrystalAssets; noise: THREE.Texture; journey: RefObject<Journey>; reduced: boolean }) {
  const rig = useRef<THREE.Group>(null), crystals = useRef<THREE.Group>(null)
  const shards = useMemo(() => CRYSTAL_KINDS.map(()=>createRef<THREE.Group>()), [])
  const iceMeshes = useMemo(() => CRYSTAL_KINDS.map(()=>createRef<THREE.Mesh>()), [])
  const rearMeshes = useMemo(() => CRYSTAL_KINDS.map(()=>createRef<THREE.Mesh>()), [])
  const coreMeshes = useMemo(() => CRYSTAL_KINDS.map(()=>createRef<THREE.Mesh>()), [])
  const detail = useRef({ index: -1, target: 0, progress: 0 })
  const { size, gl, scene } = useThree()
  const buffer = useFBO(Math.round(size.width * .75), Math.round(size.height * .75), { type: THREE.HalfFloatType })
  const backBuffer = useFBO(Math.round(size.width*.75),Math.round(size.height*.75),{type:THREE.HalfFloatType})
  const time = useRef(0)
  const direction = useMemo(() => new THREE.Vector3(), [])
  const savedResolution = useMemo(() => new THREE.Vector2(), [])
  const capture = useMemo(() => ({ frustum: new THREE.Frustum(), projection: new THREE.Matrix4(), sphere: new THREE.Sphere(), visible: CRYSTAL_KINDS.map(()=>false) }), [])
  const landscape = useMemo(() => scene.getObjectByName('polar-landscape'), [scene])
  const interaction = useRef<CrystalInteraction>({ active: false, uv: new THREE.Vector2(.5,.5) })
  const projectsInteraction = useRef<CrystalInteraction>({ active: false, uv: new THREE.Vector2(.5,.5) })
  const aboutInteraction = useRef<CrystalInteraction>({ active: false, uv: new THREE.Vector2(.5,.5) })
  const frost = useCrystalFrost(assets,interaction,reduced)
  const projectsFrost = useCrystalFrost(assets,projectsInteraction,reduced)
  const aboutFrost = useCrystalFrost(assets,aboutInteraction,reduced)
  const fields = useMemo(() => [frost,projectsFrost,aboutFrost], [frost,projectsFrost,aboutFrost])
  const interactions = useMemo(() => [interaction,projectsInteraction,aboutInteraction], [])
  const surfaces = useMemo(() => [assets,assets.projects,assets.about], [assets])
  const interactive = (index: number) => {
    const state=crystalJourney(journey.current.value)
    return state[`${CRYSTAL_KINDS[index]}Interactive`]
  }
  const center = (index: number,explicit=false) => window.dispatchEvent(new CustomEvent('portfolio:center-crystal',{detail:explicit?{kind:CRYSTAL_KINDS[index],explicit:true}:CRYSTAL_KINDS[index]}))
  const move = (index: number, event: ThreeEvent<PointerEvent>) => {
    if (!interactive(index)) return
    event.stopPropagation()
    const state=interactions[index].current
    const entering=!state.active
    if(event.uv1)portfolioAudio.excite('shard',entering?.15:state.uv.distanceTo(event.uv1)*12)
    if (event.uv1 && event.object === iceMeshes[index].current) state.uv.copy(event.uv1)
    state.active = true
    gl.domElement.style.cursor = 'pointer'
    if(entering)center(index)
  }
  const leave = (index: number) => { interactions[index].current.active = false; gl.domElement.style.cursor = '' }
  const explore = (index: number, event: ThreeEvent<MouseEvent>) => {
    if (!interactive(index) || event.delta > 6) return
    event.stopPropagation()
    center(index,true)
    leave(index)
    window.dispatchEvent(new Event(`portfolio:open-${CRYSTAL_KINDS[index]}`))
  }
  useEffect(() => () => { gl.domElement.style.cursor = '' }, [gl])
  useEffect(() => {
    const change = (event: Event) => {
      const request = (event as CustomEvent<{ kind: string; open: boolean }>).detail
      const index = CRYSTAL_KINDS.findIndex(kind => kind === request.kind)
      if (index < 0) return
      detail.current.index = index
      detail.current.target = request.open ? 1 : 0
      interactions.forEach((_, index) => leave(index))
    }
    window.addEventListener('portfolio:crystal-detail', change)
    return () => window.removeEventListener('portfolio:crystal-detail', change)
  }, [interactions])
  const prepareIce = useCallback((material: THREE.MeshPhysicalMaterial | null, index: number) => {
    if (!material || material.userData.atmosphericIce) return
    material.userData.atmosphericIce = true
    const compile = material.onBeforeCompile
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer)
      shader.uniforms.surfaceFrost = fields[index]
      shader.uniforms.clearTransmission = {value:backBuffer.texture}
      shader.uniforms.frostTriangles = { value: assets.triangles }
      shader.uniforms.iceTint = { value: new THREE.Vector3().fromArray(index===2?[.27,.34,.44]:[.42,.49,.60]) }
      shader.uniforms.iceTintStrength = { value: index===2?.3:.22 }
      shader.uniforms.iceSurfaceRoughness = { value: index===2?.7:1 }
      shader.vertexShader = 'attribute vec2 frostUv;varying vec2 vFrostUv;\n'+shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvFrostUv=frostUv;')
      shader.fragmentShader = 'uniform vec3 iceTint;uniform float iceTintStrength;uniform float iceSurfaceRoughness;uniform sampler2D clearTransmission;uniform sampler2D surfaceFrost;uniform sampler2D frostTriangles;varying vec2 vFrostUv;\n'+shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('vec4 transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );',`vec4 transmittedLight = getTransmissionSample(clamp(refractionCoords,vec2(.001),vec2(.999)),roughness,ior);
        vec4 straightClip=projMatrix*viewMatrix*vec4(position,1.);
        vec2 straightUv=clamp(straightClip.xy/straightClip.w*.5+.5,vec2(.001),vec2(.999));
        vec4 clearLight=texture2D(clearTransmission,straightUv);
        float valid=step(0.,refractionCoords.x)*step(refractionCoords.x,1.)*step(0.,refractionCoords.y)*step(refractionCoords.y,1.);
        float energy=smoothstep(.004,.035,max(transmittedLight.r,max(transmittedLight.g,transmittedLight.b)));
        transmittedLight=mix(clearLight,transmittedLight,valid*energy);`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor*=iceSurfaceRoughness*(1.-texture2D(surfaceFrost,vFrostUv).r*.95);')
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;mapN.xy*=1.-texture2D(surfaceFrost,vFrostUv).r;'))
      shader.fragmentShader = shader.fragmentShader.replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',`vec2 field=texture2D(surfaceFrost,vFrostUv).rg;
        float grid=texture2D(frostTriangles,vNormalMapUv*9.).r;
        totalEmissiveRadiance+=vec3(.23,.36,.56)*field.g*2.+vec3(grid)*(field.g*10.+field.r*field.r);
        vec3 outgoingLight=totalDiffuse+totalSpecular+totalEmissiveRadiance;`)
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.rgb=mix(clamp(gl_FragColor.rgb,0.,1.),iceTint,iceTintStrength);')
    }
    material.needsUpdate = true
  }, [assets,fields,backBuffer])
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
  const materialLifetime=useMemo(()=>({users:0,preparation:Promise.resolve()}),[materials])
  useEffect(() => { scene.userData.crystalGrade = assets.grade; return () => { delete scene.userData.crystalGrade } }, [scene, assets])
  useEffect(() => {
    if(!crystals.current)return
    let cancelled=false
    const warmScene=new THREE.Scene(), warmCamera=new THREE.PerspectiveCamera(30,1,.1,100)
    const copy=crystals.current.clone(true)
    copy.visible=true;copy.position.set(0,0,-6.6);copy.rotation.set(0,0,0)
    copy.children.forEach(shard=>{shard.position.set(0,0,0);shard.rotation.set(0,0,0)})
    copy.traverse(object=>{object.visible=true})
    warmScene.add(copy)
    const plane=new THREE.PlaneGeometry(40,30)
    const backdrop=new THREE.Mesh(plane,materials.background)
    backdrop.position.z=-10
    warmScene.add(backdrop)
    const target=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType})
    // Compile both permanent face variants before either is needed on scroll.
    // A tiny offscreen draw also uploads their textures and initializes the buffers.
    materialLifetime.preparation=gl.compileAsync(warmScene,warmCamera).then(()=>{
      if(cancelled)return
      const previous=gl.getRenderTarget()
      try{
        gl.initRenderTarget(buffer);gl.initRenderTarget(backBuffer)
        gl.setRenderTarget(target);gl.render(warmScene,warmCamera)
      }finally{gl.setRenderTarget(previous);target.dispose();plane.dispose()}
    }).catch(error=>{if(!cancelled)console.error('Crystal shader preparation:',error)})
    return ()=>{cancelled=true;target.dispose();plane.dispose()}
  },[gl,assets,buffer,backBuffer,materials,materialLifetime])
  useFrame(({ gl, scene, camera }) => {
    camera.updateMatrixWorld()
    capture.frustum.setFromProjectionMatrix(capture.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))
    const visibleShards=capture.visible
    shards.forEach((shard,index)=>{
      const mesh=iceMeshes[index].current
      visibleShards[index]=false
      if(!shard.current?.visible || !mesh?.visible)return
      mesh.updateWorldMatrix(true,false)
      capture.sphere.copy(mesh.geometry.boundingSphere!).applyMatrix4(mesh.matrixWorld)
      visibleShards[index]=capture.frustum.intersectsSphere(capture.sphere)
    })
    // Keep the sky and drifting lines alive across the gap without paying for
    // two HDR captures when neither ice surface can contribute a screen pixel.
    if (!visibleShards.some(Boolean)) return
    const previous=gl.getRenderTarget(), alpha=materials.background.uniforms.alpha.value
    savedResolution.copy(materials.background.uniforms.resolution.value)
    const visible=landscape?.visible
    iceMeshes.forEach(mesh=>{if(mesh.current)mesh.current.visible=false})
    // The embedded logo extends beyond concave parts of the source shell.
    // Include it in refraction, never as an exposed opaque face on closed ice.
    coreMeshes.forEach(mesh=>{if(mesh.current)mesh.current.visible=true})
    if(landscape) landscape.visible=false
    materials.background.uniforms.alpha.value=1
    materials.background.uniforms.resolution.value.set(buffer.width,buffer.height)
    try {
      gl.setRenderTarget(backBuffer);gl.clear();gl.render(scene,camera)
      rearMeshes.forEach((mesh,index)=>{if(mesh.current)mesh.current.visible=visibleShards[index]})
      gl.setRenderTarget(buffer);gl.clear();gl.render(scene,camera)
    } finally {
      rearMeshes.forEach(mesh=>{if(mesh.current)mesh.current.visible=false})
      coreMeshes.forEach((mesh,index)=>{if(mesh.current)mesh.current.visible=detail.current.index===index&&detailPose(detail.current.progress).shell>0})
      gl.setRenderTarget(previous);materials.background.uniforms.alpha.value=alpha
      materials.background.uniforms.resolution.value.copy(savedResolution)
      iceMeshes.forEach((mesh,index)=>{if(mesh.current)mesh.current.visible=detailPose(detail.current.index===index?detail.current.progress:0).shell<.999})
      if(landscape) landscape.visible=Boolean(visible)
    }
  }, .2)
  useEffect(() => {
    materialLifetime.users++
    return()=>{materialLifetime.users--;void materialLifetime.preparation.then(()=>{if(materialLifetime.users===0)Object.values(materials).forEach(material=>material.dispose())})}
  }, [materials,materialLifetime])
  useFrame(({ camera, size, gl }, delta) => {
    interactions.forEach((state,index)=>{if(!interactive(index)&&state.current.active)leave(index)})
    const p = journey.current.value, travel = journeyView(p)
    const opening = detail.current
    // Closing walks the same trajectory backwards, including a close that
    // interrupts the entrance. Reduced motion changes directly to its endpoint.
    const step = Math.min(delta, .1) / .9
    opening.progress = reduced ? opening.target : THREE.MathUtils.clamp(opening.target, opening.progress-step, opening.progress+step)
    if (!reduced) time.current += Math.min(delta, .1)
    if (rig.current) {
      rig.current.visible = p > .05 && p < 4.1
      camera.getWorldDirection(direction)
      rig.current.position.copy(camera.position).addScaledVector(direction, 6.6)
      rig.current.quaternion.copy(camera.quaternion)
    }
    shards.forEach((reference,index)=>{
      const shard=reference.current
      if(!shard)return
      const pose=crystalPose(p,CRYSTAL_KINDS[index])
      shard.visible=pose.visible
      const rolling=pose.roll
      const expanded = detailPose(opening.index === index ? opening.progress : 0)
      // Opacity is an existing material uniform: changing it never compiles a
      // new shader or adds a render target on the opening frame.
      for (const reference of [iceMeshes[index], rearMeshes[index]]) {
        const mesh = reference.current
        if (!mesh) continue
        mesh.scale.setScalar(expanded.shellScale)
        if (reference === iceMeshes[index]) mesh.visible = expanded.shell < .999
        const material = mesh.material as THREE.MeshPhysicalMaterial
        material.opacity = 1-expanded.shell
      }
      const core=coreMeshes[index].current
      if(core){core.scale.setScalar(expanded.coreScale);core.visible=expanded.shell>0}
      shard.position.y=pose.y
      // The reference rotates all three axes with distance from the resting
      // position. Scroll reversal follows this exact pose back, without tweens.
      shard.rotation.set(
        reduced ? 0 : rolling*11.2+Math.sin(time.current*.3+index*.7)*.055,
        reduced ? 0 : -rolling*9.8+Math.sin(time.current*.24+index*.9)*.09+expanded.turn,
        reduced ? 0 : -rolling*4.8+Math.sin(time.current*.28+index*.5)*.04,
      )
      shard.scale.setScalar(size.width < 700 ? .68 : index===0 ? 1 : index===1 ? .88 : .9)
    })
    materials.background.uniforms.alpha.value = travel.mist
    materials.background.uniforms.time.value = time.current
    materials.background.uniforms.aspect.value = size.width/size.height
    materials.background.uniforms.resolution.value.set(size.width*gl.getPixelRatio(),size.height*gl.getPixelRatio())
    materials.background.uniforms.scroll.value = p
  }, .1)
  return <group ref={rig} name="portfolio-crystals">
    <mesh position={[0,0,-4]} material={materials.background} renderOrder={7}><planeGeometry args={[40,30]} /></mesh>
    <group ref={crystals}>
    {surfaces.map((surface,index)=><group key={CRYSTAL_KINDS[index]} ref={shards[index]} name={`${CRYSTAL_KINDS[index]}-crystal`} onPointerMove={event=>move(index,event)} onPointerOut={()=>leave(index)} onClick={event=>explore(index,event)}>
      <mesh ref={iceMeshes[index]} geometry={surface.geometry} renderOrder={12}>
        <MeshTransmissionMaterial transparent ref={material => prepareIce(material as unknown as THREE.MeshPhysicalMaterial,index)} resolution={1} buffer={buffer.texture} samples={8} color="#e0e8ef" roughness={.65} roughnessMap={surface.roughness} normalMap={surface.normal} normalScale={new THREE.Vector2(1,1)} envMap={assets.environment} envMapIntensity={.91} envMapRotation={new THREE.Euler(0,Math.PI,0)} ior={1.18} reflectivity={.3} thickness={2} transmission={1} chromaticAberration={.1} anisotropicBlur={0} temporalDistortion={0} />
      </mesh>
      <mesh ref={rearMeshes[index]} visible={false} geometry={surface.geometry} renderOrder={12} raycast={()=>{}}>
        <MeshTransmissionMaterial transparent ref={material => prepareIce(material as unknown as THREE.MeshPhysicalMaterial,index)} side={THREE.BackSide} resolution={1} buffer={backBuffer.texture} samples={8} color="#e0e8ef" roughness={.65} roughnessMap={surface.roughness} normalMap={surface.normal} normalScale={new THREE.Vector2(1,1)} envMap={assets.environment} envMapIntensity={.91} envMapRotation={new THREE.Euler(0,Math.PI,0)} ior={1.18} reflectivity={.3} thickness={2} transmission={1} chromaticAberration={.1} anisotropicBlur={0} temporalDistortion={0} />
      </mesh>
      <mesh ref={coreMeshes[index]} geometry={assets.core} material={materials.core} renderOrder={11} />
      <CrystalPlexus reduced={reduced} active={shards[index]} radius={surface.geometry.boundingSphere!.radius*.9} />
      <CrystalAnnotations crystal={shards[index]} bounds={surface.geometry.boundingBox!} kind={CRYSTAL_KINDS[index]} journey={journey} />
    </group>)}
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
      else { loaded = result; setAssets(result); document.querySelector('#app')?.setAttribute('data-crystal-ready', 'true') }
    }).catch(error => { if (!cancelled) { console.error('Crystal:', error); document.querySelector('#app')?.setAttribute('data-crystal-error', 'true') } })
    return () => { cancelled = true; loaded?.dispose() }
  }, [gl])
  return assets && <CrystalView assets={assets} noise={noise} journey={journey} reduced={reduced} />
}

