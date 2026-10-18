// Extract the zero isosurface of the reference's signed-distance volume away
// from the render thread. Positions and normals stay on the GPU afterwards.
self.onmessage = ({ data: { data, size, masks = [] } }) => {
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
  const social = masks.map(mask => {
    const inside=[],border=[],width=256
    for(let y=1;y<width-1;y++)for(let x=1;x<width-1;x++){
      const i=y*width+x
      if(mask[i]<128)continue
      inside.push(i)
      if(mask[i-1]<128||mask[i+1]<128||mask[i-width]<128||mask[i+width]<128)border.push(i)
    }
    const positions=new Float32Array(p.length),normals=new Float32Array(n.length)
    let seed=789123
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
    for(let i=0;i<positions.length;i+=3){
      const side=random()<.28,list=side?border:inside
      const pixel=list[Math.floor(random()*list.length)],x=pixel%width,y=Math.floor(pixel/width)
      const sign=random()<.5?-1:1
      positions[i]=(.5-(x+random())/width)*.43
      positions[i+1]=(.5-(y+random())/width)*.43
      positions[i+2]=side?(random()-.5)*.065:sign*(.0325+(random()-.5)*.001)
      if(side){
        const dx=mask[pixel-1]-mask[pixel+1],dy=mask[pixel-width]-mask[pixel+width],len=Math.hypot(dx,dy)||1
        normals[i]=-dx/len;normals[i+1]=-dy/len
      }else normals[i+2]=sign
    }
    return {positions,normals}
  })
  self.postMessage({ positions: p, normals: n, social }, [p.buffer, n.buffer,...social.flatMap(item=>[item.positions.buffer,item.normals.buffer])])
}
