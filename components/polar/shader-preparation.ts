import type * as THREE from 'three'

export function compileForTarget(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget) {
  // Three's shader key includes the destination color space and attachment
  // configuration. Compiling against the screen then drawing into an HDR
  // target silently recompiles a different variant on the first visible frame.
  const previous = renderer.getRenderTarget()
  try {
    renderer.setRenderTarget(target)
    return renderer.compileAsync(scene, camera)
  } finally {
    // compileAsync starts compilation synchronously; never keep global renderer
    // state changed while its promise waits for parallel compilation to finish.
    renderer.setRenderTarget(previous)
  }
}
