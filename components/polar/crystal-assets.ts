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
    const result = await draco.loadAsync(`/scene/geometry/${name}.drc`)
    resources.push(result)
    result.computeBoundingBox()
    return result
  }
  async function texture(name: string, color = false) {
    const result = await ktx.loadAsync(`/scene/textures/${name}.ktx2`)
    result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    resources.push(result)
    return result
  }
  try {
    const [geometryMap, core, normal, roughness, coreMap, source] = await Promise.all([
      geometry('crystal'), geometry('crystal-core'), texture('crystal_normal'),
      texture('crystal_roughness'), texture('crystal_core', true),
      new EXRLoader().loadAsync('/scene/textures/crystal_env.exr').then(result => { resources.push(result); return result }),
    ])
    const generator = new THREE.PMREMGenerator(renderer)
    const environment = generator.fromEquirectangular(source)
    generator.dispose()
    resources.push(environment)
    draco.dispose(); ktx.dispose()
    return { geometry: geometryMap, core, normal, roughness, coreMap, environment: environment.texture, dispose }
  } catch (error) { dispose(); throw error }
}
