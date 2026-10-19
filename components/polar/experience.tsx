'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Wordmark } from './wordmark'
import { crystalCenter, isCrystalKind, JOURNEY_END, type Journey } from './journey'
import { CrystalReadout } from './crystal-readout'
import { SocialControls } from './social-controls'
import { scrollToJourney, journeyToScroll } from './scroll-path'

const App3D = dynamic(() => import('./scene'), { ssr: false })

function Fallback() {
  return <div className="fallback"><p>The expedition needs WebGL 2.<br />Try a browser with hardware acceleration enabled.</p></div>
}

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? <Fallback /> : this.props.children }
}

export function PolarExperience() {
  const [ready, setReady] = useState(false)
  const [supported, setSupported] = useState<boolean | null>(null)
  const [sound, setSound] = useState(false)
  const [audioReady, setAudioReady] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const audio = useRef<HTMLAudioElement>(null)
  const journey = useRef<Journey>({ target: 0, value: 0 })

  useEffect(() => {
    const track = document.querySelector<HTMLElement>('.journey-track')
    let distance = 1
    let centering: number | null = null
    let intentUntil = 0
    // Scroll events only sample position; layout is measured when the track resizes.
    const update = () => {
      journey.current.target = scrollToJourney(JOURNEY_END * Math.min(1, Math.max(0, window.scrollY / distance)))
      if (centering !== null && Math.abs(window.scrollY-centering)<1) centering=null
    }
    const cancelCenter = () => {
      centering=null
      intentUntil=performance.now()+350
    }
    const reverseLoop=()=>{
      if(window.scrollY>.5||document.querySelector('dialog[open]'))return
      cancelCenter()
      journey.current.value=journey.current.target=JOURNEY_END-.001
      window.dispatchEvent(new Event('portfolio:reset-motion'))
      window.scrollTo({top:distance-1,behavior:'instant'})
    }
    const wheel=(event:WheelEvent)=>{cancelCenter();if(event.deltaY<0)reverseLoop()}
    let touchStart=0
    const touch=(event:TouchEvent)=>{cancelCenter();touchStart=event.touches[0]?.clientY||0}
    const drag=(event:TouchEvent)=>{if((event.touches[0]?.clientY||0)>touchStart+8)reverseLoop()}
    const wrapped=()=>{cancelCenter();window.scrollTo({top:0,behavior:'instant'})}
    const navigationKey = (event: KeyboardEvent) => {
      if(event.defaultPrevented)return
      if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) cancelCenter()
      if(['ArrowUp','PageUp'].includes(event.key)||(event.key===' '&&event.shiftKey))reverseLoop()
    }
    const centerCrystal = (event: Event) => {
      const kind=(event as CustomEvent<unknown>).detail
      if (!isCrystalKind(kind) || performance.now()<intentUntil) return
      const destination=distance*journeyToScroll(crystalCenter(kind))/JOURNEY_END
      if (centering===destination || Math.abs(window.scrollY-destination)<1) return
      centering=destination
      // The shared renderer spring owns easing, including hover centering.
      // A second eased RAF here used to add latency and fight fresh wheel input.
      window.scrollTo({top:destination,behavior:'instant'})
      update()
    }
    const measure = () => {
      cancelCenter()
      distance = Math.max(1, (track?.offsetHeight || window.innerHeight * (1+2.2*JOURNEY_END)) - window.innerHeight)
      update()
    }
    const observer = new ResizeObserver(measure)
    if (track) observer.observe(track)
    measure()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('portfolio:center-crystal',centerCrystal)
    window.addEventListener('wheel',wheel,{passive:true})
    window.addEventListener('touchstart',touch,{passive:true})
    window.addEventListener('touchmove',drag,{passive:true})
    window.addEventListener('portfolio:journey-wrapped',wrapped)
    window.addEventListener('keydown',navigationKey)
    return () => {
      cancelCenter();observer.disconnect()
      window.removeEventListener('scroll',update);window.removeEventListener('resize',measure)
      window.removeEventListener('portfolio:center-crystal',centerCrystal)
      window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',touch)
      window.removeEventListener('touchmove',drag);window.removeEventListener('portfolio:journey-wrapped',wrapped)
      window.removeEventListener('keydown',navigationKey)
    }
  }, [])

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2')
    setSupported(Boolean(context))
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    if (!context) setReady(true)
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(preference.matches)
    sync()
    preference.addEventListener('change', sync)
    const worker = new Worker('/workers/wind.js')
    let url: string | undefined
    worker.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
      url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }))
      if (audio.current) { audio.current.src = url; audio.current.volume = .55; setAudioReady(true) }
    }
    worker.postMessage(null)
    return () => { worker.terminate(); if (url) URL.revokeObjectURL(url); preference.removeEventListener('change', sync) }
  }, [])

  async function toggleSound() {
    if (!audio.current || !audioReady) return
    if (sound) { audio.current.pause(); setSound(false) }
    else {
      try { await audio.current.play(); setSound(true) } catch { setSound(false) }
    }
  }

  return <div className="journey-track"><main id="app">
    <div id="webgl" aria-hidden="true">
      {supported === false ? <Fallback /> : supported && <SceneBoundary onFailure={() => setReady(true)}><App3D onReady={() => setReady(true)} reducedMotion={reducedMotion} journey={journey} /></SceneBoundary>}
    </div>
    <div className="vignette" />
    <div id="ice-measurements" aria-hidden="true" />
    <CrystalReadout />
    <CrystalReadout kind="projects" />
    <CrystalReadout kind="about" />
    <SocialControls />
    <div className="crystal-atmosphere" aria-hidden="true"><span>DESIGN / ENGINEERING</span><span>01 / SYSTEMS</span></div>
    <header className="identity">
      <h1><Wordmark reducedMotion={reducedMotion} /></h1>
      <p className="role">// Software Engineer</p>
      <p className="specialties">Built with curiosity.<br />Full Stack / AI / Experiments</p>
    </header>
    <aside className="intro" aria-label="About Tuaha">
      <p className="index">////// Tuaha Shaikh</p>
      <p>Software engineer<br />exploring the space<br />between thoughtful<br />design and intelligent<br />systems. From an idea<br />to something real.</p>
      <nav aria-label="Social links"><a href="https://github.com/TUAHASHAIKH" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.linkedin.com/in/tuaha-shaikh-b7122526a" target="_blank" rel="noreferrer">LinkedIn ↗</a></nav>
    </aside>
    <footer className="bottom-bar">
      <button className="sound-toggle" onClick={toggleSound} aria-pressed={sound} disabled={!audioReady} aria-label={sound ? 'Mute ambient wind' : 'Play ambient wind'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z" />{sound ? <><path d="M15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>
        <span>Sound: {sound ? 'On' : 'Off'}</span>
      </button>
    </footer>
    <audio className="audio-output" ref={audio} loop preload="none" onPause={() => setSound(false)} />
    <div id="loader" data-ready={ready} role="status" aria-live="polite" aria-label={ready ? 'Scene ready' : 'Preparing the landscape'}>
      <span className="loader-name">TUAHA SHAIKH</span><span className="ascii" aria-hidden="true">---===+++===---</span><span className="loader-caption">ASSEMBLING A SMALL WORLD</span>
    </div>
    <p className="sr-only">Interactive snowy landscape with an igloo. Move over its ice blocks to gently separate them. Scroll through the skills, projects, and about me crystals into the particle contact chamber. Use the left and right arrow keys or the on-screen arrows to choose GitHub, LinkedIn, or WhatsApp, then activate the selected link. Continue scrolling to return to the igloo. All links and sound controls are accessible by keyboard.</p>
  </main></div>
}
