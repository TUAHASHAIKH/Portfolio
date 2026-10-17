'use client'

import dynamic from 'next/dynamic'
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Wordmark } from './wordmark'

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

  return <main id="app">
    <div id="webgl" aria-hidden="true">
      {supported === false ? <Fallback /> : supported && <SceneBoundary onFailure={() => setReady(true)}><App3D onReady={() => setReady(true)} reducedMotion={reducedMotion} /></SceneBoundary>}
    </div>
    <div className="vignette" />
    <header className="identity">
      <h1><Wordmark /></h1>
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
    <p className="sr-only">Interactive snowy landscape with an igloo. Move over its ice blocks to gently separate them. This visual scene contains no essential navigation. All links and sound controls are accessible by keyboard.</p>
  </main>
}
