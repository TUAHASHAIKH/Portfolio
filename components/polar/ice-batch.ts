import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeIceMaterial } from './materials'
import type { PolarAssets } from './assets'

// Every block keeps its original geometry, UVs and independent motion. A tiny
// transform atlas replaces one draw call and material submission per block.
export function makeIceBatch(assets: PolarAssets) {
  const geometries = assets.pieces.map((piece, index) => {
    const geometry = piece.geometry.clone()
    geometry.setAttribute('pieceIndex', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(index), 1))
    return geometry
  })
  const geometry = mergeGeometries(geometries)!
  geometries.forEach(item => item.dispose())
  const data = new Float32Array(assets.pieces.length * 20)
  const texture = new THREE.DataTexture(data, 5, assets.pieces.length, THREE.RGBAFormat, THREE.FloatType)
  texture.minFilter = texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false
  const material = makeIceMaterial(assets)
  material.uniforms.iceTransforms = { value: texture }
  material.vertexShader = `uniform sampler2D iceTransforms;attribute float pieceIndex;varying float pieceSeparation;varying float pieceBounce;\n${material.vertexShader}`
    .replace('surfaceUv = uv;', `
      int row = int(pieceIndex);
      mat4 blockMatrix = mat4(texelFetch(iceTransforms,ivec2(0,row),0),texelFetch(iceTransforms,ivec2(1,row),0),texelFetch(iceTransforms,ivec2(2,row),0),texelFetch(iceTransforms,ivec2(3,row),0));
      vec2 lighting = texelFetch(iceTransforms,ivec2(4,row),0).rg;
      pieceSeparation = lighting.x;pieceBounce = lighting.y;
      vec4 blockPosition = blockMatrix * vec4(position,1.);
      surfaceUv = uv;`)
    .replaceAll('vec4(position, 1.)', 'blockPosition')
  material.fragmentShader = material.fragmentShader
    .replace('uniform float separation;', 'varying float pieceSeparation;\n#define separation pieceSeparation')
    .replace('uniform float bounce;', 'varying float pieceBounce;\n#define bounce pieceBounce')
  const write = (index: number, matrix: THREE.Matrix4, separation: number, bounce: number) => {
    const offset = index * 20
    matrix.toArray(data, offset)
    data[offset + 16] = separation
    data[offset + 17] = bounce
  }
  const initial = new THREE.Matrix4()
  assets.pieces.forEach((piece, index) => write(index, initial.makeTranslation(piece.center), 0, 0))
  texture.needsUpdate = true
  return { geometry, material, texture, write, dispose: () => { geometry.dispose(); material.dispose(); texture.dispose() } }
}
