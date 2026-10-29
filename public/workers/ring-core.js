// Extract the zero isosurface of the reference's signed-distance volume away
// from the render thread. Positions and normals stay on the GPU afterwards.

// Squared Euclidean distance to the closest filled pixel, in linear time per
// row/column. Using an actual distance field preserves holes and disconnected
// pieces (the LinkedIn dot and WhatsApp handset) during surface attraction.
function distanceTransform(mask, filled) {
  const width=256,field=new Float32Array(width*width),output=new Float32Array(width*width)
  const input=new Float64Array(width),result=new Float64Array(width)
  const sites=new Int32Array(width),edges=new Float64Array(width+1)
  const transform=()=>{
    let k=0;sites[0]=0;edges[0]=-Infinity;edges[1]=Infinity
    for(let q=1;q<width;q++){
      let edge
      do {
        const p=sites[k]
        edge=((input[q]+q*q)-(input[p]+p*p))/(2*(q-p))
        if(edge<=edges[k])k--;else break
      } while(k>=0)
      k++;sites[k]=q;edges[k]=edge;edges[k+1]=Infinity
    }
    k=0
    for(let q=0;q<width;q++){
      while(edges[k+1]<q)k++
      result[q]=(q-sites[k])**2+input[sites[k]]
    }
  }
  for(let y=0;y<width;y++){
    for(let x=0;x<width;x++)input[x]=(mask[y*width+x]>=128)===filled?0:1e10
    transform();for(let x=0;x<width;x++)field[y*width+x]=result[x]
  }
  for(let x=0;x<width;x++){
    for(let y=0;y<width;y++)input[y]=field[y*width+x]
    transform();for(let y=0;y<width;y++)output[y*width+x]=result[y]
  }
  return output
}

function socialVolume(mask) {
  const size=128,span=.65/1.2,step=span/size,halfDepth=.025,rounding=.004,distanceScale=.2
  const toInside=distanceTransform(mask,true),toOutside=distanceTransform(mask,false)
  const planar=new Float32Array(256*256)
  for(let i=0;i<planar.length;i++){
    const distance=Math.sqrt(toInside[i])-Math.sqrt(toOutside[i])
    planar[i]=(distance-Math.sign(distance)*.5)*.43/256
  }
  const sample=(x,y)=>{
    const cx=(.5-x/.43)*256-.5,cy=(.5-y/.43)*256-.5
    const px=Math.max(0,Math.min(255,cx)),py=Math.max(0,Math.min(255,cy))
    const ix=Math.floor(px),iy=Math.floor(py),jx=Math.min(255,ix+1),jy=Math.min(255,iy+1)
    const fx=px-ix,fy=py-iy
    const top=planar[iy*256+ix]*(1-fx)+planar[iy*256+jx]*fx
    const bottom=planar[jy*256+ix]*(1-fx)+planar[jy*256+jx]*fx
    return top*(1-fy)+bottom*fy+Math.hypot(cx-px,cy-py)*.43/256
  }
  const plane=new Float32Array(size*size),distances=new Float32Array(size**3)
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)plane[y*size+x]=sample((x+.5)*step-span*.5,(y+.5)*step-span*.5)+rounding
  for(let z=0;z<size;z++){
    const depth=Math.abs((z+.5)*step-span*.5)-(halfDepth-rounding)
    for(let i=0;i<plane.length;i++){
      const edge=plane[i]
      distances[z*size*size+i]=Math.hypot(Math.max(edge,0),Math.max(depth,0))+Math.min(Math.max(edge,depth),0)-rounding
    }
  }
  const volume=new Uint8Array(size**3*4)
  const at=(x,y,z)=>distances[(z*size+y)*size+x]
  const encode=value=>Math.round(Math.max(0,Math.min(1,value))*255)
  for(let z=0;z<size;z++)for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=(z*size+y)*size+x
    const dx=at(Math.min(size-1,x+1),y,z)-at(Math.max(0,x-1),y,z)
    const dy=at(x,Math.min(size-1,y+1),z)-at(x,Math.max(0,y-1),z)
    const dz=at(x,y,Math.min(size-1,z+1))-at(x,y,Math.max(0,z-1))
    const length=Math.hypot(dx,dy,dz)||1
    volume[i*4]=encode(dx/length*.5+.5);volume[i*4+1]=encode(dy/length*.5+.5);volume[i*4+2]=encode(dz/length*.5+.5)
    volume[i*4+3]=encode(distances[i]/distanceScale*.5+.5)
  }
  return {volume,volumeSize:size,distanceScale,halfDepth}
}

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
  // Match the reference budget without concentrating samples in one region.
  const sourceCount=positions.length/3,count=sourceCount?150000:0
  const p=new Float32Array(count*3),n=new Float32Array(count*3)
  for(let i=0;i<count;i++){
    const source=Math.floor(i*sourceCount/count)*3
    for(let k=0;k<3;k++){p[i*3+k]=positions[source+k];n[i*3+k]=normals[source+k]}
  }
  const social = masks.map(mask => {
    const field=socialVolume(mask)
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
      positions[i+2]=side?(random()-.5)*field.halfDepth*2:sign*(field.halfDepth+(random()-.5)*.001)
      if(side){
        const dx=mask[pixel-1]-mask[pixel+1],dy=mask[pixel-width]-mask[pixel+width],len=Math.hypot(dx,dy)||1
        normals[i]=-dx/len;normals[i+1]=-dy/len
      }else normals[i+2]=sign
    }
    return {positions,normals,...field}
  })
  self.postMessage({ positions: p, normals: n, social }, [p.buffer, n.buffer,...social.flatMap(item=>[item.positions.buffer,item.normals.buffer,item.volume.buffer])])
}
