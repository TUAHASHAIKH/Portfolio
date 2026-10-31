'use client'

import { preload } from 'react-dom'

// Emit these hints in the initial HTML, before hydration and the WebGL bundle.
// Fetch-mode/credentials match Three's FileLoader and the geometry fetches so
// the browser consumes the same responses instead of downloading them twice.
export function HeroPreloads() {
  for (const name of ['draco/draco_wasm_wrapper.js', 'draco/draco_decoder.wasm', 'basis/basis_transcoder.js', 'basis/basis_transcoder.wasm']) {
    preload(`/scene/${name}`, { as: 'fetch', crossOrigin: 'anonymous' })
  }
  for (const name of ['igloo_exploded_color', 'igloo_color', 'ground_color', 'terrain_color', 'mountain_color', 'ground_glow']) {
    // Keep CSS and executable JavaScript ahead of the large binary downloads.
    preload(`/scene/textures/${name}.ktx2`, { as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'low' })
  }
  preload('/scene/geometry/igloo.drc', { as: 'fetch', crossOrigin: 'anonymous', fetchPriority: 'low' })
  return null
}
