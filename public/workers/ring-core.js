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
      const gradient = [0, 1, 2].map(k => (data[a + k] * (1 - blend) + data[b + k] * blend) / 127.5 - 1)
      const length = Math.hypot(...gradient) || 1, normal = gradient.map(n => n / length)
      const reference = Math.abs(normal[1]) < .9 ? [0, 1, 0] : [1, 0, 0]
      const tangent = [normal[1] * reference[2] - normal[2] * reference[1], normal[2] * reference[0] - normal[0] * reference[2], normal[0] * reference[1] - normal[1] * reference[0]]
      const tangentLength = Math.hypot(...tangent) || 1
      for (let k = 0; k < 3; k++) tangent[k] /= tangentLength
      const bitangent = [normal[1] * tangent[2] - normal[2] * tangent[1], normal[2] * tangent[0] - normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]]
      // Dense subpixel grains retain the sculpture's smooth silhouette instead
      // of enlarging sparse particles into visible squares.
      for (let sample = 0; sample < 16; sample++) {
        const random = k => { const v = Math.sin((a + sample * 73 + k * 317) * 12.9898) * 43758.5453; return v - Math.floor(v) }
        const radius = Math.sqrt(random(0)), angle = random(1) * Math.PI * 2
        for (let k = 0; k < 3; k++) {
          const jitter = tangent[k] * radius * Math.cos(angle) + bitangent[k] * radius * Math.sin(angle) + normal[k] * (random(2) - .5) * .05
          positions.push((([x, y, z][k] + step[k] * blend + jitter) / (size - 1) - .5) * .65 / 1.2)
          normals.push(normal[k])
        }
      }
    }
  }
  const p = new Float32Array(positions), n = new Float32Array(normals)
  self.postMessage({ positions: p, normals: n }, [p.buffer, n.buffer])
}
