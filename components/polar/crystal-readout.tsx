'use client'

import { useCallback, useEffect, useRef } from 'react'

export function CrystalReadout({ kind = 'skills' }: { kind?: 'skills' | 'projects' }) {
  const projects = kind === 'projects'
  const title = projects ? 'Projects' : 'Skills'
  const index = projects ? '02' : '01'
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const temperature = useRef<HTMLSpanElement>(null)
  const celsius = useRef<HTMLSpanElement>(null)
  const center = useCallback(() => {
    window.dispatchEvent(new CustomEvent('portfolio:center-crystal',{detail:kind}))
  },[kind])
  const open = useCallback(() => {
    if (dialog.current?.open) return
    center()
    dialog.current?.showModal()
    heading.current?.focus()
  }, [center])
  useEffect(() => {
    const event = `portfolio:open-${kind}`
    window.addEventListener(event, open)
    return () => window.removeEventListener(event, open)
  }, [open,kind])
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const started = performance.now()
    const update = () => {
      if (document.hidden || document.querySelector('#app')?.getAttribute('data-stage') !== 'crystal') return
      const time = preference.matches ? 0 : (performance.now()-started)/1000
      const degrees = projects ? -3+Math.sin(time*.05+.13)*2 : Math.sin(time*.05+1)*2
      if (temperature.current) temperature.current.textContent = (degrees*1.8+32).toFixed(2)
      if (celsius.current) celsius.current.textContent = `${degrees<0?'-':'+'}${Math.abs(degrees).toFixed(2).padStart(5,'0')}`
    }
    update()
    const timer = window.setInterval(update,100)
    return () => window.clearInterval(timer)
  }, [projects])
  return <section className="crystal-readout" data-crystal={kind} aria-label={`Portfolio crystal: ${kind}`}>
    <svg className="crystal-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="title-leader" d="M310 224H390L433 308" />
      <path className="explore-leader" d="M535 714H645" />
    </svg>
    <h2 className="crystal-title">PORTFOLIO_CO_{index}<br />{title.toUpperCase()}</h2>
    <p className="crystal-temperature" aria-hidden="true">TEMP&nbsp;&nbsp; <span ref={temperature}>35.03</span><br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span ref={celsius}>+01.68</span></p>
    <button className="crystal-explore" onPointerEnter={center} onFocus={center} onClick={open} onKeyDown={event => { if(event.key==='Enter'||event.key===' '){event.preventDefault();open()} }} aria-haspopup="dialog">{index} / {title.toUpperCase()}<br />CLICK TO EXPLORE</button>
    <p className="crystal-unavailable" role="status">The crystal could not load. Refresh to try again.</p>
    <dialog ref={dialog} className="skills-dialog" aria-labelledby={`${kind}-heading`} onClick={event => { if(event.target === event.currentTarget) dialog.current?.close() }}>
      <form method="dialog"><button aria-label={`Close ${kind}`}>[ CLOSE ]</button></form>
      <p>PORTFOLIO_CO_{index}</p><h2 id={`${kind}-heading`} ref={heading} tabIndex={-1}>{title}</h2>
      {projects ? <><p>Explore my repositories, experiments, and work in progress.</p><a href="https://github.com/TUAHASHAIKH?tab=repositories" target="_blank" rel="noreferrer">VIEW PROJECTS ON GITHUB ↗</a></> : <dl>
        <dt>Languages</dt><dd>C / C++ / Java / Python / PHP / JavaScript</dd>
        <dt>Web</dt><dd>React / Node.js / Express / Django / HTML / CSS</dd>
        <dt>Data</dt><dd>MySQL / MongoDB / PL/SQL / pandas / NumPy / scikit-learn</dd>
        <dt>Practice</dt><dd>Problem solving / Cryptography / Data visualization</dd>
      </dl>}
    </dialog>
  </section>
}
