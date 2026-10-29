import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'
import { socialMasks } from './social-links'

export type RingAssets = Awaited<ReturnType<typeof loadRingAssets>>

// Decode independently of the landing scene. One decoder worker keeps scrolling
// responsive while these assets are prepared in the background.
export async function loadRingAssets(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath('/scene/draco/').setWorkerLimit(1)
  const ktx = new KTX2Loader().setTranscoderPath('/scene/basis/').setWorkerLimit(1).detectSupport(renderer)
  const resources: { dispose: () => void }[] = []
  let worker: Worker | undefined
  const dispose = () => { worker?.terminate(); resources.forEach(item => item.dispose()); draco.dispose(); ktx.dispose() }
  async function geometry(name: string, attributes: string[]) {
    const response = await fetch(`/scene/geometry/${name}.drc`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    const decoder = draco as DRACOLoader & { decodeGeometry: (buffer: ArrayBuffer, config: object) => Promise<THREE.BufferGeometry> }
    const result = await decoder.decodeGeometry(await response.arrayBuffer(), {
      attributeIDs: Object.fromEntries(attributes.map((key, index) => [key, index])),
      attributeTypes: Object.fromEntries(attributes.map(key => [key, 'Float32Array'])),
      useUniqueIDs: true, vertexColorSpace: THREE.LinearSRGBColorSpace,
    })
    result.computeBoundingSphere(); resources.push(result)
    return result
  }
  async function texture(name: string, repeat = false, data = false) {
    const result = await ktx.loadAsync(`/scene/textures/${name}.ktx2`)
    result.colorSpace = data || name === 'ring_core_volume' ? THREE.NoColorSpace : THREE.SRGBColorSpace
    if (repeat) result.wrapS = result.wrapT = THREE.RepeatWrapping
    result.needsUpdate = true; resources.push(result)
    return result
  }
  try {
    const [outer, inner, plasma, floor, outerMap, outerGlow, innerMap, innerGlow, floorMap, clouds, triangles, volume, blue, scroll] = await Promise.all([
      geometry('ring-shattered-outer', ['position','normal','uv','centr','rand']),
      geometry('ring-shattered-inner', ['position','normal','uv','centr','rand']),
      geometry('ring-plasma', ['position','normal','uv']),
      geometry('ring-floor', ['position','normal','uv','animationmask','iteration','glow']),
      texture('ring_outer_color'), texture('ring_outer_glow'), texture('ring_inner_color'), texture('ring_inner_glow'),
      texture('ring_floor_color'), texture('ring_clouds', true), texture('crystal_triangles', true), texture('ring_core_volume'),
      texture('ring_blue_noise',true,true),texture('ring_scroll_noise',true,true),
    ])
    const image = volume.image as { data: Uint8Array; width: number; height: number; depth: number }
    const data = image.data.slice()
    const masks = socialMasks()
    const volumes: THREE.Texture[] = [volume]
    worker = new Worker('/workers/ring-core.js')
    const core = await new Promise<THREE.BufferGeometry>((resolve, reject) => {
      worker!.onerror = event => reject(new Error(event.message))
      worker!.onmessage = event => {
        const result = new THREE.BufferGeometry()
        result.setAttribute('position', new THREE.BufferAttribute(event.data.positions, 3))
        result.setAttribute('normal', new THREE.BufferAttribute(event.data.normals, 3))
        for(let index=0;index<masks.length;index++){
          const social=event.data.social[index]
          result.setAttribute(`socialPosition${index+1}`,new THREE.BufferAttribute(social.positions,3))
          result.setAttribute(`socialNormal${index+1}`,new THREE.BufferAttribute(social.normals,3))
          const texture=new THREE.Data3DTexture(social.volume,social.volumeSize,social.volumeSize,social.volumeSize)
          texture.format=THREE.RGBAFormat;texture.type=THREE.UnsignedByteType
          texture.minFilter=texture.magFilter=THREE.LinearFilter
          texture.userData.distanceScale=social.distanceScale
          texture.needsUpdate=true;volumes.push(texture);resources.push(texture)
        }
        result.computeBoundingSphere(); resources.push(result)
        resolve(result)
      }
      worker!.postMessage({ data, size: image.width, masks }, [data.buffer,...masks.map(mask=>mask.buffer)])
    })
    worker.terminate(); worker = undefined
    draco.dispose(); ktx.dispose()
    return { outer, inner, plasma, floor, outerMap, outerGlow, innerMap, innerGlow, floorMap, clouds, triangles, core, volume, volumes, blue, scroll, dispose }
  } catch (error) { dispose(); throw error }
}
