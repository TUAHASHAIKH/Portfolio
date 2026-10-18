import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

export type CrystalAssets = Awaited<ReturnType<typeof loadCrystalAssets>>

function fillCrystalPit(geometry: THREE.BufferGeometry) {
  const positions=geometry.getAttribute('position') as THREE.BufferAttribute
  const normals=geometry.getAttribute('normal') as THREE.BufferAttribute
  const normal=new THREE.Vector3(), faceNormal=new THREE.Vector3(.15,0,1).normalize()
  // Close the deep right-hand recess that reads as a black puncture through refractive ice.
  // Keep the original UVs and surface maps on the repaired faces.
  for(let index=0;index<positions.count;index++){
    const x=positions.getX(index),y=positions.getY(index),z=positions.getZ(index)
    const radius=Math.hypot((x-.565)/.1,(y+.065)/.085)
    const weight=(1-THREE.MathUtils.smoothstep(radius,.45,1.15))*THREE.MathUtils.smoothstep(z,.24,.35)*(1-THREE.MathUtils.smoothstep(z,.43,.57))
    if(weight<=0)continue
    positions.setZ(index,THREE.MathUtils.lerp(z,Math.max(z,.5-.15*(x-.565)),weight))
    normal.fromBufferAttribute(normals,index).lerp(faceNormal,weight).normalize()
    normals.setXYZ(index,normal.x,normal.y,normal.z)
  }
  positions.needsUpdate=true;normals.needsUpdate=true
}

// This section loads independently, so an unavailable crystal never prevents the hero loading.
export async function loadCrystalAssets(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath('/scene/draco/').setWorkerLimit(1)
  const ktx = new KTX2Loader().setTranscoderPath('/scene/basis/').setWorkerLimit(1).detectSupport(renderer)
  const resources: { dispose: () => void }[] = []
  const dispose = () => { resources.forEach(item => item.dispose()); draco.dispose(); ktx.dispose() }
  async function geometry(name: string) {
    const response = await fetch(`/scene/geometry/${name}.drc`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    const isCrystal = name === 'crystal' || name === 'projects-crystal'
    const attributes = isCrystal ? ['position','normal','uv','uv1'] : ['position','normal','uv']
    const decoder = draco as DRACOLoader & { decodeGeometry: (buffer: ArrayBuffer, config: object) => Promise<THREE.BufferGeometry> }
    const result = await decoder.decodeGeometry(await response.arrayBuffer(), {
      attributeIDs: Object.fromEntries(attributes.map((key,index)=>[key,index])),
      attributeTypes: Object.fromEntries(attributes.map(key=>[key,'Float32Array'])),
      useUniqueIDs: true, vertexColorSpace: THREE.LinearSRGBColorSpace,
    })
    resources.push(result)
    if(name==='crystal')fillCrystalPit(result)
    result.computeBoundingBox()
    result.computeBoundingSphere()
    if (isCrystal) result.setAttribute('frostUv',result.getAttribute('uv1'))
    return result
  }
  async function texture(name: string, color = false) {
    const result = await ktx.loadAsync(`/scene/textures/${name}.ktx2`)
    result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    result.magFilter = THREE.LinearFilter
    result.minFilter = result.mipmaps.length > 1 ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter
    if (name === 'crystal_grade') { result.minFilter = THREE.LinearFilter; result.magFilter = THREE.LinearFilter }
    if (name === 'crystal_mist' || name === 'crystal_triangles') result.wrapS = result.wrapT = THREE.RepeatWrapping
    result.needsUpdate = true
    resources.push(result)
    return result
  }
  try {
    const [geometryMap, core, normal, roughness, coreMap, source, grade, mist, triangles, advect, projectsGeometry, projectsNormal, projectsRoughness] = await Promise.all([
      geometry('crystal'), geometry('crystal-core'), texture('crystal_normal'),
      texture('crystal_roughness'), texture('crystal_core', true),
      new EXRLoader().loadAsync('/scene/textures/crystal_env.exr').then(result => { resources.push(result); return result }),
      texture('crystal_grade'), texture('crystal_mist'), texture('crystal_triangles', true),
      new THREE.TextureLoader().loadAsync('/scene/textures/crystal_advect.png').then(result => {
        result.colorSpace=THREE.NoColorSpace; result.wrapS=result.wrapT=THREE.RepeatWrapping; resources.push(result); return result
      }),
      geometry('projects-crystal'), texture('projects_crystal_normal'), texture('projects_crystal_roughness'),
    ])
    const generator = new THREE.PMREMGenerator(renderer)
    const environment = generator.fromEquirectangular(source)
    generator.dispose()
    resources.push(environment)
    draco.dispose(); ktx.dispose()
    return { geometry: geometryMap, core, normal, roughness, coreMap, environment: environment.texture, grade, mist, triangles, advect,
      projects: { geometry: projectsGeometry, normal: projectsNormal, roughness: projectsRoughness }, dispose }
  } catch (error) { dispose(); throw error }
}
