// Extract the zero isosurface of the reference's signed-distance volume away
// from the render thread. Positions and normals stay on the GPU afterwards.
self.onmessage = ({ data: { data, size } }) => {
  const positions = [], normals = []
  const offset = (x, y, z) => ((z * size + y) * size + x) * 4
  for (let z = 1; z < size - 1; z++) for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    const a = offset(x, y, z), start = data[a + 3] - 127.5
    for (let axis = 0; axis < 3; axis++) {
      const step = [axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0]
      const b = offset(x + step[0], y + step[1], z + step[2]), end = data[b + 3] - 127.5
      if (start * end > 0 || start === end) continue
      const blend = start / (start - end)
      // Four deterministic samples per crossing give a dense, granular surface.
      for (let sample = 0; sample < 4; sample++) {
        const jitter = k => (Math.sin((a + sample * 73 + k * 317) * 12.9898) * 43758.5453 % 1) * .35
        for (let k = 0; k < 3; k++) {
          positions.push((([x, y, z][k] + step[k] * blend + jitter(k)) / (size - 1) - .5) * .65 / 1.2)
          normals.push((data[a + k] * (1 - blend) + data[b + k] * blend) / 127.5 - 1)
        }
      }
    }
  }
  const p = new Float32Array(positions), n = new Float32Array(normals)
  self.postMessage({ positions: p, normals: n }, [p.buffer, n.buffer])
}
