'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

/** Keep the label leaders attached to the rotating ice rather than fixed screen coordinates. */
export function CrystalAnnotations({ crystal, bounds }: { crystal: RefObject<THREE.Group|null>; bounds: THREE.Box3 }) {
  const elements=useRef<{svg:SVGSVGElement;title:HTMLElement;temperature:HTMLElement;explore:HTMLElement;titleLine:SVGPathElement;exploreLine:SVGPathElement}|null>(null)
  const point=useMemo(()=>new THREE.Vector3(),[])
  useFrame(({camera,size})=>{
    if(!crystal.current)return
    if(!elements.current){
      const root=document.querySelector('.crystal-readout')
      if(!root)return
      elements.current={svg:root.querySelector('svg')!,title:root.querySelector('.crystal-title')!,temperature:root.querySelector('.crystal-temperature')!,explore:root.querySelector('.crystal-explore')!,titleLine:root.querySelector('.title-leader')!,exploreLine:root.querySelector('.explore-leader')!}
    }
    const el=elements.current, scale=Math.min(size.width/1440,size.height/806), margin=14
    crystal.current.updateWorldMatrix(true,false)
    const project=(x:number,y:number,z:number)=>{
      point.set(THREE.MathUtils.lerp(bounds.min.x,bounds.max.x,x),THREE.MathUtils.lerp(bounds.max.y,bounds.min.y,y),THREE.MathUtils.lerp(bounds.min.z,bounds.max.z,z))
      point.applyMatrix4(crystal.current!.matrixWorld).project(camera)
      return {x:(point.x+1)*size.width*.5,y:(1-point.y)*size.height*.5}
    }
    el.svg.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`)
    const mobile=size.width<700
    const title=project(.35,.15,.93), endX=Math.max(margin,title.x-(mobile?size.width*.32:170*scale)), endY=title.y-(mobile?size.height*.065:65*scale)
    el.titleLine.setAttribute('d',`M${title.x} ${title.y}L${endX+110*scale} ${endY}H${endX}`)
    el.title.style.left=`${endX}px`;el.title.style.top=`${endY-el.title.offsetHeight-14*scale}px`
    const temperature=project(.7,.15,.93)
    el.temperature.style.left=`${Math.min(size.width-el.temperature.offsetWidth-margin,temperature.x+25*scale)}px`
    el.temperature.style.top=`${temperature.y-12*scale}px`
    const explore=project(.7,.75,.95), right=Math.min(size.width-margin,explore.x+(mobile?size.width*.25:140*scale))
    el.exploreLine.setAttribute('d',`M${explore.x} ${explore.y}H${right}`)
    el.explore.style.left=`${right-el.explore.offsetWidth}px`;el.explore.style.right='auto';el.explore.style.top=`${explore.y-el.explore.offsetHeight}px`
  },.3)
  return null
}
