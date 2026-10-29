'use client'

import { useEffect, useRef, useState } from 'react'
import { portfolioAudio } from './audio-engine'

export function Wordmark({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const [sequence, setSequence] = useState(0)
  const [active, setActive] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function replay() {
    portfolioAudio.cue('logo')
    portfolioAudio.excite('brand', 1)
    if (reducedMotion) return
    if (timer.current) clearTimeout(timer.current)
    setSequence(value => value + 1)
    setActive(true)
    // The reference replays its logo reveal for .25 seconds on hover.
    timer.current = setTimeout(() => setActive(false), 250)
  }

  return <button type="button" className="wordmark-trigger" aria-label="Tuaha" onPointerEnter={replay} onFocus={replay} onClick={replay}>
    <span className="sr-only">Tuaha</span>
    <span key={sequence} className="wordmark-layers" data-glitch={active} aria-hidden="true">
      <img className="wordmark-image wordmark-base" src="/images/tuaha-wordmark.svg" alt="" width={530} height={88} draggable={false} />
      <img className="wordmark-image wordmark-slice wordmark-slice-a" src="/images/tuaha-wordmark.svg" alt="" width={530} height={88} draggable={false} />
      <img className="wordmark-image wordmark-slice wordmark-slice-b" src="/images/tuaha-wordmark.svg" alt="" width={530} height={88} draggable={false} />
    </span>
  </button>
}
