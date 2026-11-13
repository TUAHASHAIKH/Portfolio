import type * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js'

type Pool = { draco: DRACOLoader; ktx: KTX2Loader; users: number; idle?: ReturnType<typeof setTimeout> }
const pools = new WeakMap<THREE.WebGLRenderer, Pool>()

export function acquireDecoders(renderer: THREE.WebGLRenderer) {
  let pool = pools.get(renderer)
  if (!pool) {
    pool = {
      draco: new DRACOLoader().setDecoderPath('/scene/draco/').setWorkerLimit(1),
      ktx: new KTX2Loader().setTranscoderPath('/scene/basis/').setWorkerLimit(2).detectSupport(renderer),
      users: 0,
    }
    pools.set(renderer, pool)
  }
  const current = pool
  clearTimeout(current.idle)
  current.users++
  let released = false
  return { draco: current.draco, ktx: current.ktx, release: () => {
    if (released) return
    released = true
    if (--current.users) return
    // Reuse the decoder code and workers across the staged sections, then
    // release idle workers. Never dispose a decoder while another load uses it.
    current.idle = setTimeout(() => {
      current.draco.dispose(); current.ktx.dispose(); pools.delete(renderer)
    }, 30000)
  } }
}
