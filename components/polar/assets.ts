import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

export type IcePiece = { geometry: THREE.BufferGeometry; center: THREE.Vector3; seed: THREE.Vector3 }
export type PolarAssets = Awaited<ReturnType<typeof loadPolarAssets>>

// Three exposes this task API at runtime, but its companion typings omit it.
type AttributeDecoder = DRACOLoader & {
  decodeGeometry(buffer: ArrayBuffer, config: {
    attributeIDs: Record<string, number>
    attributeTypes: Record<string, string>
    useUniqueIDs: boolean
    vertexColorSpace: string
  }): Promise<THREE.BufferGeometry>
}

function separateIce(source: THREE.BufferGeometry): IcePiece[] {
  const batches = source.getAttribute('batchId')
  const index = source.getIndex()!
  const groups = new Map<number, number[]>()
  for (let i = 0; i < index.count; i++) {
    const vertex = index.getX(i), id = batches.getX(vertex)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id)!.push(vertex)
  }
  return [...groups.values()].map(vertices => {
    const center = new THREE.Vector3().fromBufferAttribute(source.getAttribute('centr'), vertices[0])
    const seed = new THREE.Vector3().fromBufferAttribute(source.getAttribute('rand'), vertices[0])
    const geometry = new THREE.BufferGeometry()
    const remap = new Map<number, number>()
    const indices = vertices.map(vertex => {
      if (!remap.has(vertex)) remap.set(vertex, remap.size)
      return remap.get(vertex)!
    })
    for (const name of ['position', 'normal', 'uv', 'emission']) {
      const attribute = source.getAttribute(name)
      const values = new Float32Array(remap.size * attribute.itemSize)
      remap.forEach((next, previous) => {
        for (let axis = 0; axis < attribute.itemSize; axis++) {
          values[next * attribute.itemSize + axis] = attribute.array[previous * attribute.itemSize + axis]
        }
      })
      geometry.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize))
    }
    geometry.translate(-center.x, -center.y, -center.z)
    geometry.setIndex(indices)
    geometry.computeBoundingSphere()
    return { geometry, center, seed }
  })
}

export async function loadPolarAssets(renderer: THREE.WebGLRenderer) {
  const draco = new DRACOLoader().setDecoderPath('/scene/draco/').setWorkerLimit(1)
  const ktx = new KTX2Loader().setTranscoderPath('/scene/basis/').setWorkerLimit(2).detectSupport(renderer)
  const geometries: THREE.BufferGeometry[] = [], textures: THREE.Texture[] = []
  async function geometry(name: string, ice = false, customAttributes?: string[]) {
    const response = await fetch(`/scene/geometry/${name}.drc`)
    if (!response.ok) throw new Error(`Could not load ${name}`)
    const attributes = customAttributes || (ice ? ['position', 'normal', 'uv', 'centr', 'rand', 'emission', 'batchId'] : ['position', 'normal', 'uv'])
    const result = await (draco as AttributeDecoder).decodeGeometry(await response.arrayBuffer(), {
      attributeIDs: Object.fromEntries(attributes.map((key, index) => [key, index])),
      attributeTypes: Object.fromEntries(attributes.map(key => [key, key === 'batchId' ? 'Uint16Array' : 'Float32Array'])),
      useUniqueIDs: true,
      vertexColorSpace: THREE.LinearSRGBColorSpace,
    })
    geometries.push(result)
    return result
  }
  async function texture(name: string, data = false) {
    const result = await ktx.loadAsync(`/scene/textures/${name}.ktx2`)
    result.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace
    if (data) { result.magFilter = THREE.LinearFilter; result.minFilter = THREE.LinearFilter }
    result.needsUpdate = true
    result.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    textures.push(result)
    return result
  }
  const dispose = () => { geometries.forEach(item => item.dispose()); textures.forEach(item => item.dispose()); draco.dispose(); ktx.dispose() }
  try {
    const [ice, ground, mountain, patch, closed, opened, groundMap, glow, terrainMap, mountainMap, grade, wind, introCage, introOutline, introParticles, numbers, iceTriangles] = await Promise.all([
      geometry('igloo', true), geometry('ground'), geometry('mountain'), geometry('patch'),
      texture('igloo_color'), texture('igloo_exploded_color'), texture('ground_color'), texture('ground_glow'),
      texture('terrain_color'), texture('mountain_color'), texture('grade', true), texture('wind_noise'),
      geometry('intro-cage', false, ['position', 'color', 'centr']),
      geometry('intro-outline', false, ['position', 'color']),
      geometry('intro-particles', false, ['position', 'color']), texture('numbers', true),
      texture('crystal_triangles'),
    ])
    const pieces = separateIce(ice)
    pieces.forEach(piece => geometries.push(piece.geometry))
    wind.wrapS = wind.wrapT = THREE.RepeatWrapping
    wind.needsUpdate = true
    iceTriangles.wrapS = iceTriangles.wrapT = THREE.RepeatWrapping
    iceTriangles.needsUpdate = true
    // Decoders are only needed during the initial load.
    draco.dispose(); ktx.dispose()
    return { pieces, ground, mountain, patch, closed, opened, groundMap, glow, terrainMap, mountainMap, grade, wind, introCage, introOutline, introParticles, numbers, iceTriangles, dispose }
  } catch (error) { dispose(); throw error }
}
