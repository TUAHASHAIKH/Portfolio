'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

/** Keep the label leaders attached to the rotating ice rather than fixed screen coordinates. */
export function CrystalAnnotations({ crystal, bounds }: { crystal: RefObject<THREE.Group|null>; bounds: THREE.Box3 }) {
  const elements=useRef<{svg:SVGSVGElement;title:HTMLElement;temperature:HTMLElement;explore:HTMLElement;titleLine:SVGPathElement;exploreLine:SVGPathElement}|null>(null)
  const metrics=useRef(new Map<HTMLElement,{width:number;height:number}>())
  const point=useMemo(()=>new THREE.Vector3(),[])
  useEffect(()=>{
    const root=document.querySelector('.crystal-readout')
    if(!root)return
    const el={svg:root.querySelector('svg')!,title:root.querySelector<HTMLElement>('.crystal-title')!,temperature:root.querySelector<HTMLElement>('.crystal-temperature')!,explore:root.querySelector<HTMLElement>('.crystal-explore')!,titleLine:root.querySelector<SVGPathElement>('.title-leader')!,exploreLine:root.querySelector<SVGPathElement>('.explore-leader')!}
    elements.current=el
    // Never read layout after moving a label in the frame loop. Font and viewport
    // changes refresh these dimensions independently of the animation.
    const observer=new ResizeObserver(entries=>{
      for(const entry of entries){
        const box=entry.borderBoxSize[0]
        metrics.current.set(entry.target as HTMLElement,{width:box.inlineSize,height:box.blockSize})
      }
    })
    for(const label of [el.title,el.temperature,el.explore]){
      metrics.current.set(label,{width:label.offsetWidth,height:label.offsetHeight})
      observer.observe(label)
      label.style.left='0';label.style.top='0';label.style.right='auto'
    }
    return ()=>{observer.disconnect();elements.current=null}
  },[])
  useFrame(({camera,size})=>{
    if(!crystal.current?.visible || !elements.current)return
    const el=elements.current, scale=Math.min(size.width/1440,size.height/806), margin=14
    const dimensions=metrics.current
    const place=(label:HTMLElement,x:number,y:number)=>{
      label.style.transform=`translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`
    }
    crystal.current.updateWorldMatrix(true,false)
    const project=(x:number,y:number,z:number)=>{
      point.set(THREE.MathUtils.lerp(bounds.min.x,bounds.max.x,x),THREE.MathUtils.lerp(bounds.max.y,bounds.min.y,y),THREE.MathUtils.lerp(bounds.min.z,bounds.max.z,z))
      point.applyMatrix4(crystal.current!.matrixWorld).project(camera)
      return {x:(point.x+1)*size.width*.5,y:(1-point.y)*size.height*.5}
    }
    const viewBox=`0 0 ${size.width} ${size.height}`
    if(el.svg.getAttribute('viewBox')!==viewBox)el.svg.setAttribute('viewBox',viewBox)
    const mobile=size.width<700
    const title=project(.35,.15,.93), endX=Math.max(margin,title.x-(mobile?size.width*.32:170*scale)), endY=title.y-(mobile?size.height*.065:65*scale)
    el.titleLine.setAttribute('d',`M${title.x} ${title.y}L${endX+110*scale} ${endY}H${endX}`)
    place(el.title,endX,endY-dimensions.get(el.title)!.height-14*scale)
    const temperature=project(.7,.15,.93)
    place(el.temperature,Math.min(size.width-dimensions.get(el.temperature)!.width-margin,temperature.x+25*scale),temperature.y-12*scale)
    const explore=project(.7,.75,.95), right=Math.min(size.width-margin,explore.x+(mobile?size.width*.25:140*scale))
    el.exploreLine.setAttribute('d',`M${explore.x} ${explore.y}H${right}`)
    place(el.explore,right-dimensions.get(el.explore)!.width,explore.y-dimensions.get(el.explore)!.height)
  },.3)
  return null
}
