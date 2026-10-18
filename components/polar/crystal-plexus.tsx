'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

type Link = { from: number; to: number; progress: number; leaving: boolean }
const random = (index: number) => THREE.MathUtils.euclideanModulo(Math.sin(index*127.1+19.7)*43758.5453,1)

export function CrystalPlexus({ reduced, radius }: { reduced: boolean; radius: number }) {
  const time=useRef(0), links=useRef<Link[]>([]), epoch=useRef(-1)
  const resources=useMemo(()=>{
    const geometry=new THREE.BufferGeometry()
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(512*3),3))
    geometry.setAttribute('visibility',new THREE.BufferAttribute(new Float32Array(512),1))
    const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      vertexShader:'attribute float visibility;varying float alpha;void main(){alpha=visibility;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying float alpha;void main(){gl_FragColor=vec4(.85,.9,1.,alpha);}',
    })
    const points=Array.from({length:18},(_,index)=>({
      position:new THREE.Vector3(), angle:random(index*4)*Math.PI*2,
      radius:radius*(.8+random(index*4+1)*.2), y:random(index*4+2)*3,
      seed:random(index*4+3), wrapped:false, eligible:false, shown:0,
    }))
    return {geometry,material,points}
  },[radius])
  useEffect(()=>()=>{resources.geometry.dispose();resources.material.dispose()},[resources])
  useFrame((_,frameDelta)=>{
    const delta=Math.min(frameDelta,.1)
    if(!reduced)time.current+=delta
    const {points,geometry}=resources
    points.forEach(point=>{
      const angle=point.angle+(point.seed-.5)*time.current*.5, previous=point.position.y
      const y=THREE.MathUtils.euclideanModulo(point.y+point.seed*time.current*.25+1.5,3)-1.5
      point.position.set(Math.cos(angle)*point.radius+Math.sin(time.current*.5+point.seed*2.324)*.1,y,Math.sin(angle)*point.radius+Math.sin(time.current*.5+point.seed*9.564)*.1)
      point.wrapped=Math.abs(previous-y)>1.5
      point.eligible=Math.abs(y)<1.125&&!point.wrapped
    })
    const current=links.current
    current.forEach(link=>{if(!points[link.from].eligible||!points[link.to].eligible)link.leaving=true})
    const tick=Math.floor(time.current/.35)
    if(tick!==epoch.current){
      epoch.current=tick
      const degree=new Array<number>(18).fill(0)
      current.filter(link=>!link.leaving).forEach(link=>{degree[link.from]++;degree[link.to]++})
      const candidates: {from:number;to:number;order:number}[]=[]
      points.forEach((point,from)=>points.forEach((other,to)=>{
        if(to<=from||!point.eligible||!other.eligible||point.position.distanceTo(other.position)>=3||current.some(link=>link.from===from&&link.to===to))return
        candidates.push({from,to,order:random(from*18+to+tick*37)})
      }))
      candidates.sort((a,b)=>a.order-b.order).forEach(({from,to})=>{
        if(degree[from]>=3||degree[to]>=3)return
        current.push({from,to,progress:reduced?1:0,leaving:false});degree[from]++;degree[to]++
      })
    }
    for(let i=current.length-1;i>=0;i--){
      const link=current[i]
      link.progress=reduced?(link.leaving?0:1):THREE.MathUtils.clamp(link.progress+(link.leaving?-1:1)*delta/.35,0,1)
      if(link.leaving&&link.progress===0)current.splice(i,1)
    }
    points.forEach((point,index)=>{
      const target=current.some(link=>(link.from===index||link.to===index)&&!link.leaving)?1:0
      point.shown=reduced?target:THREE.MathUtils.damp(point.shown,target,8,delta)
    })
    const positions=geometry.getAttribute('position') as THREE.BufferAttribute, visibility=geometry.getAttribute('visibility') as THREE.BufferAttribute
    let vertex=0
    const write=(x:number,y:number,z:number,light:number)=>{positions.setXYZ(vertex,x,y,z);visibility.setX(vertex,light);vertex++}
    points.forEach(({position:p,shown})=>{
      write(p.x-.012,p.y,p.z,shown*.55);write(p.x+.012,p.y,p.z,shown*.55)
      write(p.x,p.y-.018,p.z,shown*.55);write(p.x,p.y+.018,p.z,shown*.55)
    })
    current.forEach(link=>{
      const a=points[link.from].position,b=points[link.to].position,light=link.progress*.28
      write(a.x,a.y,a.z,light);write(THREE.MathUtils.lerp(a.x,b.x,link.progress),THREE.MathUtils.lerp(a.y,b.y,link.progress),THREE.MathUtils.lerp(a.z,b.z,link.progress),light)
    })
    geometry.setDrawRange(0,vertex);positions.needsUpdate=true;visibility.needsUpdate=true
  })
  return <lineSegments name="crystal-dynamic-plexus" geometry={resources.geometry} material={resources.material} frustumCulled={false} raycast={()=>{}} renderOrder={16}/>
}
