'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SOCIAL_LINKS, socialIndex } from './social-links'

export function SocialControls(){
  const [selected,setSelected]=useState(0)
  const current=useRef(0)
  const select=useCallback((index:number)=>{
    const next=socialIndex(index);current.current=next;setSelected(next)
    window.dispatchEvent(new CustomEvent('portfolio:social-select',{detail:next}))
  },[])
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return
      if(document.querySelector('#app')?.getAttribute('data-stage')!=='contact')return
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();select(current.current+(event.key==='ArrowRight'?1:-1))
      }
    }
    window.addEventListener('keydown',keyboard)
    return()=>window.removeEventListener('keydown',keyboard)
  },[select])
  return <section className="social-chamber" aria-label="Connect with Tuaha">
    <button className="social-arrow social-previous" aria-label="Previous social profile" onClick={()=>select(selected-1)}><svg viewBox="0 0 80 24" aria-hidden="true"><path d="M78 18H3L16 4" /></svg></button>
    <button className="social-arrow social-next" aria-label="Next social profile" onClick={()=>select(selected+1)}><svg viewBox="0 0 80 24" aria-hidden="true"><path d="M2 18H77L64 4" /></svg></button>
    <nav className="social-selector" aria-label="Particle social profiles">
      <button className="social-neighbor" onClick={()=>select(selected-1)} aria-label={`Show ${SOCIAL_LINKS[socialIndex(selected-1)].name}`}>{SOCIAL_LINKS[socialIndex(selected-1)].name}</button>
      <a className="social-current" href={SOCIAL_LINKS[selected].href} target="_blank" rel="noopener noreferrer" aria-label={`Open Tuaha's ${SOCIAL_LINKS[selected].name}`}><span aria-live="polite">{SOCIAL_LINKS[selected].name}</span><i aria-hidden="true" /></a>
      <button className="social-neighbor" onClick={()=>select(selected+1)} aria-label={`Show ${SOCIAL_LINKS[socialIndex(selected+1)].name}`}>{SOCIAL_LINKS[socialIndex(selected+1)].name}</button>
    </nav>
  </section>
}
