import * as THREE from 'three'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'

export function decodeCrystalEnvironment(buffer: ArrayBuffer) {
  const header=new DataView(buffer)
  if(buffer.byteLength<12||header.getUint32(0,true)!==0x31524d50)throw new Error('Invalid environment header')
  const width=header.getUint32(4,true),height=header.getUint32(8,true)
  if(!width||!height||width>4096||height>4096||buffer.byteLength!==12+width*height*8)throw new Error('Invalid environment dimensions')
  const texture=new THREE.DataTexture(new Uint16Array(buffer,12),width,height,THREE.RGBAFormat,THREE.HalfFloatType)
  texture.mapping=THREE.CubeUVReflectionMapping
  texture.colorSpace=THREE.LinearSRGBColorSpace
  texture.magFilter=texture.minFilter=THREE.LinearFilter
  texture.generateMipmaps=false
  texture.needsUpdate=true
  return texture
}

export async function loadCrystalEnvironment(renderer: THREE.WebGLRenderer) {
  try {
    const response=await fetch('/scene/textures/crystal_environment.bin.gz')
    if(!response.ok||!response.body)throw new Error('Environment unavailable')
    const buffer=await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    const texture=decodeCrystalEnvironment(buffer)
    return {texture,dispose:()=>texture.dispose()}
  }catch {
    // Older browsers and interrupted downloads retain the original HDR path.
    const source=await new EXRLoader().loadAsync('/scene/textures/crystal_env.exr')
    const generator=new THREE.PMREMGenerator(renderer)
    try {
      const target=generator.fromEquirectangular(source)
      return {texture:target.texture,dispose:()=>target.dispose()}
    }finally{source.dispose();generator.dispose()}
  }
}
