'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { CrystalKind } from './journey'
import { CrystalDetail } from './crystal-detail'

const readouts = {
  skills: { title:'Skills', index:'01', temperature:0, phase:1 },
  projects: { title:'Projects', index:'02', temperature:-3, phase:.13 },
  about: { title:'About Me', index:'03', temperature:-5, phase:-.87 },
}

export function CrystalReadout({ kind = 'skills' }: { kind?: CrystalKind }) {
  const {title,index,temperature:baseTemperature,phase}=readouts[kind]
  const temperature = useRef<HTMLSpanElement>(null)
  const celsius = useRef<HTMLSpanElement>(null)
  const center = useCallback(() => {
    window.dispatchEvent(new CustomEvent('portfolio:center-crystal',{detail:kind}))
  },[kind])
  const open = useCallback(() => { window.dispatchEvent(new Event(`portfolio:open-${kind}`)) }, [kind])
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const started = performance.now()
    const update = () => {
      if (document.hidden || document.querySelector('#app')?.getAttribute('data-stage') !== 'crystal') return
      const time = preference.matches ? 0 : (performance.now()-started)/1000
      const degrees = baseTemperature+Math.sin(time*.05+phase)*2
      if (temperature.current) temperature.current.textContent = (degrees*1.8+32).toFixed(2)
      if (celsius.current) celsius.current.textContent = `${degrees<0?'-':'+'}${Math.abs(degrees).toFixed(2).padStart(5,'0')}`
    }
    update()
    const timer = window.setInterval(update,100)
    return () => window.clearInterval(timer)
  }, [baseTemperature,phase])
  return <section className="crystal-readout" data-crystal={kind} aria-label={`Portfolio crystal: ${kind}`}>
    <svg className="crystal-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="title-leader" d="M310 224H390L433 308" />
      <path className="explore-leader" d="M535 714H645" />
    </svg>
    <h2 className="crystal-title">PORTFOLIO_CO_{index}<br />{title.toUpperCase()}</h2>
    <p className="crystal-temperature" aria-hidden="true">TEMP&nbsp;&nbsp; <span ref={temperature}>35.03</span><br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span ref={celsius}>+01.68</span></p>
    <button className="crystal-explore" onPointerEnter={center} onFocus={center} onClick={open} onKeyDown={event => { if(event.key==='Enter'||event.key===' '){event.preventDefault();open()} }} aria-haspopup="dialog">{index} / {title.toUpperCase()}<br />CLICK TO EXPLORE</button>
    <p className="crystal-unavailable" role="status">The crystal could not load. Refresh to try again.</p>
    <CrystalDetail kind={kind} />
  </section>
}
