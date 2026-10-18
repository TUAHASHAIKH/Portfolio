import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

export type CrystalAssets = Awaited<ReturnType<typeof loadCrystalAssets>>

// This section loads independently, so an unavailable crystal never prevents the hero loading.
export async function loadCrystalAssets(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath('/scene/draco/').setWorkerLimit(1)
  const ktx = new KTX2Loader().setTranscoderPath('/scene/basis/').setWorkerLimit(1).detectSupport(renderer)
  const resources: { dispose: () => void }[] = []
  const dispose = () => { resources.forEach(item => item.dispose()); draco.dispose(); ktx.dispose() }
  async function geometry(name: string) {
    const response = await fetch(`/scene/geometry/${name}.drc`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    const attributes = name === 'crystal' ? ['position','normal','uv','uv1'] : ['position','normal','uv']
    const decoder = draco as DRACOLoader & { decodeGeometry: (buffer: ArrayBuffer, config: object) => Promise<THREE.BufferGeometry> }
    const result = await decoder.decodeGeometry(await response.arrayBuffer(), {
      attributeIDs: Object.fromEntries(attributes.map((key,index)=>[key,index])),
      attributeTypes: Object.fromEntries(attributes.map(key=>[key,'Float32Array'])),
      useUniqueIDs: true, vertexColorSpace: THREE.LinearSRGBColorSpace,
    })
    resources.push(result)
    result.computeBoundingBox()
    if (name === 'crystal') result.setAttribute('frostUv',result.getAttribute('uv1'))
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
    const [geometryMap, core, normal, roughness, coreMap, source, grade, mist, triangles, advect] = await Promise.all([
      geometry('crystal'), geometry('crystal-core'), texture('crystal_normal'),
      texture('crystal_roughness'), texture('crystal_core', true),
      new EXRLoader().loadAsync('/scene/textures/crystal_env.exr').then(result => { resources.push(result); return result }),
      texture('crystal_grade'), texture('crystal_mist'), texture('crystal_triangles', true),
      new THREE.TextureLoader().loadAsync('/scene/textures/crystal_advect.png').then(result => {
        result.colorSpace=THREE.NoColorSpace; result.wrapS=result.wrapT=THREE.RepeatWrapping; resources.push(result); return result
      }),
    ])
    const generator = new THREE.PMREMGenerator(renderer)
    const environment = generator.fromEquirectangular(source)
    generator.dispose()
    resources.push(environment)
    draco.dispose(); ktx.dispose()
    return { geometry: geometryMap, core, normal, roughness, coreMap, environment: environment.texture, grade, mist, triangles, advect, dispose }
  } catch (error) { dispose(); throw error }
}
