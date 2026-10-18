'use client'

import { useRef } from 'react'

export function CrystalReadout() {
  const dialog = useRef<HTMLDialogElement>(null)
  return <section className="crystal-readout" aria-label="Portfolio crystal: skills">
    <svg className="crystal-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="title-leader" d="M310 224H390L433 308" />
      <path className="explore-leader" d="M535 714H645" />
    </svg>
    <h2 className="crystal-title">PORTFOLIO_CO_01<br />SKILLS</h2>
    <p className="crystal-temperature" aria-hidden="true">TEMP&nbsp;&nbsp; 34.83<br />&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; +01.57</p>
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
