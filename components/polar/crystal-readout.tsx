'use client'

import { useEffect, useRef } from 'react'

export function CrystalReadout() {
  const dialog = useRef<HTMLDialogElement>(null)
  const temperature = useRef<HTMLSpanElement>(null)
  const celsius = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const open = () => { if (!dialog.current?.open) dialog.current?.showModal() }
    window.addEventListener('portfolio:open-skills', open)
    return () => window.removeEventListener('portfolio:open-skills', open)
  }, [])
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const started = performance.now()
    const update = () => {
      if (document.hidden || document.querySelector('#app')?.getAttribute('data-stage') !== 'crystal') return
      const time = preference.matches ? 0 : (performance.now()-started)/1000
      const degrees = Math.sin(time*.05+1)*2
      if (temperature.current) temperature.current.textContent = (degrees*1.8+32).toFixed(2)
      if (celsius.current) celsius.current.textContent = `${degrees<0?'-':'+'}${Math.abs(degrees).toFixed(2).padStart(5,'0')}`
    }
    update()
    const timer = window.setInterval(update,100)
    return () => window.clearInterval(timer)
  }, [])
  return <section className="crystal-readout" aria-label="Portfolio crystal: skills">
    <div className="crystal-atmosphere" aria-hidden="true"><span>DESIGN / ENGINEERING</span><span>01 / SYSTEMS</span></div>
    <svg className="crystal-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="title-leader" d="M310 224H390L433 308" />
      <path className="explore-leader" d="M535 714H645" />
    </svg>
    <h2 className="crystal-title">PORTFOLIO_CO_01<br />SKILLS</h2>
    <p className="crystal-temperature" aria-hidden="true">TEMP&nbsp;&nbsp; <span ref={temperature}>35.03</span><br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <span ref={celsius}>+01.68</span></p>
    <button className="crystal-explore" onClick={() => dialog.current?.showModal()} aria-haspopup="dialog">01 / SKILLS<br />CLICK TO EXPLORE</button>
    <p className="crystal-unavailable" role="status">The crystal could not load. Refresh to try again.</p>
    <dialog ref={dialog} className="skills-dialog" onClick={event => { if(event.target === event.currentTarget) dialog.current?.close() }}>
      <form method="dialog"><button aria-label="Close skills">[ CLOSE ]</button></form>
      <p>PORTFOLIO_CO_01</p><h2>Skills</h2>
      <dl>
        <dt>Languages</dt><dd>C / C++ / Java / Python / PHP / JavaScript</dd>
        <dt>Web</dt><dd>React / Node.js / Express / Django / HTML / CSS</dd>
        <dt>Data</dt><dd>MySQL / MongoDB / PL/SQL / pandas / NumPy / scikit-learn</dd>
        <dt>Practice</dt><dd>Problem solving / Cryptography / Data visualization</dd>
      </dl>
    </dialog>
  </section>
}
