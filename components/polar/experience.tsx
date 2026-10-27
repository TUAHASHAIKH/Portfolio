'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Wordmark } from './wordmark'
import { crystalCenter, isCrystalKind, JOURNEY_END, type Journey } from './journey'
import { CrystalReadout } from './crystal-readout'
import { SocialControls } from './social-controls'
import { scrollToJourney, journeyToScroll, reverseScrollTarget } from './scroll-path'
import { boundedScrollTarget, ownsNavigationKey, wheelPixels } from './scroll-input'
import { portfolioAudio } from './audio-engine'
import { useSoundscape } from './use-soundscape'
import { GlitchEffects } from './glitch-effects'

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
  const audioState = useSoundscape()
  const sound = audioState.enabled
  const [reducedMotion, setReducedMotion] = useState(false)
  const journey = useRef<Journey>({ target: 0, value: 0 })

  useEffect(() => {
    const track = document.querySelector<HTMLElement>('.journey-track')
    let distance = 0
    let centering: number | null = null
    let intentUntil = 0
    let wheelRemainder = 0
    const pointer={x:0,y:0},scrollPointer={x:0,y:0}
    const point=(event:PointerEvent)=>{pointer.x=event.clientX;pointer.y=event.clientY}
    // Scroll events only sample position; layout is measured when the track resizes.
    const update = () => {
      journey.current.target = scrollToJourney(JOURNEY_END * Math.min(1, Math.max(0, window.scrollY / distance)))
      if(window.scrollY>.5)delete journey.current.reverseTarget
      if(window.scrollY<distance-1)delete journey.current.forwardTarget
      if (centering !== null && Math.abs(window.scrollY-centering)<1) centering=null
    }
    const cancelCenter = (preserveWheelFraction = false) => {
      if(!preserveWheelFraction)wheelRemainder=0
      centering=null
      intentUntil=performance.now()+350
      scrollPointer.x=pointer.x;scrollPointer.y=pointer.y
    }
    const reverseLoop=(pixels:number)=>{
      if(document.querySelector('dialog[open]'))return
      const target=reverseScrollTarget(journey.current.reverseTarget,pixels,window.scrollY,distance)
      if(target===undefined)return
      cancelCenter()
      journey.current.reverseTarget=target
      journey.current.target=0
    }
    const reversed=(event:Event)=>{
      const target=(event as CustomEvent<number>).detail
      window.scrollTo({top:distance*journeyToScroll(target)/JOURNEY_END,behavior:'instant'})
    }
    const wheel=(event:WheelEvent)=>{
      if(event.defaultPrevented||!event.cancelable||event.ctrlKey||event.metaKey||document.querySelector('dialog[open]'))return
      if(Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return
      // Native wheel animation and the scene spring used to ease the same
      // gesture twice. Sample wheel intent once; the scene owns its easing.
      event.preventDefault()
      cancelCenter(true)
      const state=journey.current
      const toPixels=(value:number)=>distance*journeyToScroll(value)/JOURNEY_END
      const current=state.forwardTarget!==undefined?distance+toPixels(state.forwardTarget-JOURNEY_END)
        :state.reverseTarget!==undefined?toPixels(state.reverseTarget)-distance:toPixels(state.target)
      const pixels=wheelPixels(event.deltaY,event.deltaMode,window.innerHeight)
      const target=boundedScrollTarget(current,toPixels(state.value),pixels,window.innerHeight*.9)+wheelRemainder
      delete state.forwardTarget
      delete state.reverseTarget
      window.scrollTo({top:Math.max(0,Math.min(distance,target)),behavior:'instant'})
      // CSSOM may round scrollY to device pixels. Retain fractional trackpad
      // deltas so slow gestures do not disappear between wheel events.
      wheelRemainder=Math.max(0,Math.min(distance,target))-window.scrollY
      update()
      if(target<0)state.reverseTarget=scrollToJourney(JOURNEY_END*(1+target/distance))
      else if(target>distance)state.forwardTarget=JOURNEY_END+scrollToJourney(JOURNEY_END*(target/distance-1))
    }
    const forwardLoop=(pixels:number)=>{
      const excess=Math.max(0,pixels-(distance-window.scrollY))
      if(!excess)return
      journey.current.forwardTarget=Math.min(JOURNEY_END*2-.001,(journey.current.forwardTarget??JOURNEY_END)+excess/distance*JOURNEY_END)
    }
    let touchStart:number|null=null
    const touch=(event:TouchEvent)=>{
      touchStart=null
      if(event.touches.length!==1||document.querySelector('dialog[open]'))return
      cancelCenter();touchStart=event.touches[0].clientY
    }
    const drag=(event:TouchEvent)=>{
      if(touchStart===null||event.touches.length!==1||document.querySelector('dialog[open]')){touchStart=null;return}
      cancelCenter()
      const next=event.touches[0].clientY,delta=next-touchStart
      if(delta>0){delete journey.current.forwardTarget;reverseLoop(delta)}
      else if(delta<0){delete journey.current.reverseTarget;forwardLoop(-delta)}
      touchStart=next
    }
    const endTouch=()=>{touchStart=null}
    const wrapped=(event:Event)=>{
      // Keep native input flowing into the next lap. The bounded scene spring
      // controls speed; a wheel-event guard must never hold the hero in place.
      const target=(event as CustomEvent<number>).detail||0
      cancelCenter();window.scrollTo({top:distance*journeyToScroll(target)/JOURNEY_END,behavior:'instant'})
    }
    const navigationKey = (event: KeyboardEvent) => {
      // Page and arrow keys belong to the detail's scroll container while open.
      if(event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey||ownsNavigationKey(event.target)||document.querySelector('dialog[open]'))return
      if(event.key==='Home'||event.key==='End'){
        delete journey.current.forwardTarget
        delete journey.current.reverseTarget
      }
      if (['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key)) cancelCenter()
      if(['ArrowUp','PageUp'].includes(event.key)||(event.key===' '&&event.shiftKey)){delete journey.current.forwardTarget;reverseLoop(event.key==='ArrowUp'?40:window.innerHeight*.9)}
      if(['ArrowDown','PageDown'].includes(event.key)||(event.key===' '&&!event.shiftKey))forwardLoop(event.key==='ArrowDown'?40:window.innerHeight*.9)
    }
    const centerCrystal = (event: Event) => {
      const detail=(event as CustomEvent<unknown>).detail
      const kind=detail&&typeof detail==='object'&&'kind'in detail?detail.kind:detail
      const explicit=Boolean(detail&&typeof detail==='object'&&'explicit'in detail&&detail.explicit===true)
      const moved=Math.hypot(pointer.x-scrollPointer.x,pointer.y-scrollPointer.y)>=16
      if (!isCrystalKind(kind) || !explicit&&(!moved||performance.now()<intentUntil||Math.abs(journey.current.value-journey.current.target)>.015)) return
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
      const nextDistance = Math.max(1, (track?.offsetHeight || window.innerHeight * (1+2.2*JOURNEY_END)) - window.innerHeight)
      if(distance&&nextDistance!==distance){
        // A rotation or mobile toolbar resize changes pixels, not the user's
        // place in the journey. Preserve the destination, including at a seam.
        window.scrollTo({top:nextDistance*journeyToScroll(journey.current.target)/JOURNEY_END,behavior:'instant'})
      }
      distance = nextDistance
      update()
    }
    const observer = new ResizeObserver(measure)
    if (track) observer.observe(track)
    measure()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', measure)
    window.addEventListener('portfolio:center-crystal',centerCrystal)
    window.addEventListener('wheel',wheel,{passive:false})
    window.addEventListener('touchstart',touch,{passive:true})
    window.addEventListener('touchmove',drag,{passive:true})
    window.addEventListener('touchend',endTouch,{passive:true})
    window.addEventListener('touchcancel',endTouch,{passive:true})
    window.addEventListener('portfolio:journey-wrapped',wrapped)
    window.addEventListener('portfolio:journey-reversed',reversed)
    window.addEventListener('pointermove',point,{capture:true,passive:true})
    window.addEventListener('keydown',navigationKey)
    return () => {
      cancelCenter();observer.disconnect()
      window.removeEventListener('scroll',update);window.removeEventListener('resize',measure)
      window.removeEventListener('portfolio:center-crystal',centerCrystal)
      window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',touch)
      window.removeEventListener('touchmove',drag);window.removeEventListener('portfolio:journey-wrapped',wrapped)
      window.removeEventListener('touchend',endTouch);window.removeEventListener('touchcancel',endTouch)
      window.removeEventListener('portfolio:journey-reversed',reversed)
      window.removeEventListener('pointermove',point,true)
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
    return () => preference.removeEventListener('change', sync)
  }, [])

  return <div className="journey-track"><main id="app">
    <GlitchEffects />
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
      <nav aria-label="Social links"><a href="https://github.com/TUAHASHAIKH" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.linkedin.com/in/muhammad-tuaha-shaikh" target="_blank" rel="noreferrer">LinkedIn ↗</a></nav>
    </aside>
    <footer className="bottom-bar">
      <button className="sound-toggle" onClick={() => void portfolioAudio.toggle()} aria-pressed={sound} aria-busy={audioState.loading} aria-label={sound ? 'Mute all sounds' : 'Enable scene sounds and music'} data-sound="short" data-glitch-trigger>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M11 4 5 9H2v6h3l6 5V4Z" />{sound ? <><path d="M15 8c2 2 2 6 0 8M18 5c4 4 4 10 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>
        <span>Sound: {audioState.loading ? 'Loading' : sound ? 'On' : 'Off'}</span>
      </button>
    </footer>
    <span className="sr-only" role="status">{audioState.failed ? 'Some sounds could not load. Toggle sound to retry.' : ''}</span>
    <div id="loader" data-ready={ready} role="status" aria-live="polite" aria-label={ready ? 'Scene ready' : 'Preparing the landscape'}>
      <span className="loader-name">TUAHA SHAIKH</span><span className="ascii" aria-hidden="true">---===+++===---</span><span className="loader-caption">ASSEMBLING A SMALL WORLD</span>
    </div>
    <p className="sr-only">Interactive snowy landscape with an igloo. Move over its ice blocks to gently separate them. Scroll through the skills, projects, and about me crystals into the particle contact chamber. Use the left and right arrow keys or the on-screen arrows to choose GitHub, LinkedIn, WhatsApp, or Gmail, then activate the selected link. Continue scrolling to return to the igloo. All links and sound controls are accessible by keyboard.</p>
  </main></div>
}
