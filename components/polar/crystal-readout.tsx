'use client'

import { useRef } from 'react'

export function CrystalReadout() {
  const dialog = useRef<HTMLDialogElement>(null)
  return <section className="crystal-readout" aria-label="Portfolio crystal: skills">
    <svg className="crystal-leaders" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      <path className="title-leader" d="M310 224H390L433 308" />
      <path className="explore-leader" d="M535 714H645" />
      <g className="crystal-plexus">
        <path d="M541 193 533 320 588 348 613 429 582 503 620 566 597 642 548 692 535 810 483 838 347 802 384 690 373 590M533 320 588 348 565 460 613 429 620 566 582 503 597 642 548 692M347 802 405 784 384 690M597 642 535 810" />
        {[ [541,193],[588,348],[613,429],[582,503],[620,566],[597,642],[548,692],[535,810],[483,838],[347,802],[384,690],[373,590] ].map(([x,y],i)=><path key={i} d={`M${x-2} ${y}h4M${x} ${y-3}v6`} />)}
      </g>
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
