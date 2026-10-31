'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { portfolioAudio } from './audio-engine'
import { isSoundName } from './audio-manifest'

export function useSoundscape() {
  const state = useSyncExternalStore(portfolioAudio.subscribe, portfolioAudio.snapshot, portfolioAudio.serverSnapshot)
  useEffect(() => {
    let started = false
    const start = () => {
      if (started || !portfolioAudio.snapshot().enabled) return
      started = true
      void portfolioAudio.enable()
    }
    const gesture = () => { start(); portfolioAudio.unlock() }
    // Prioritize the compressed landscape over 18 audio downloads. A trusted
    // early gesture still starts/unlocks sound immediately, as before.
    window.addEventListener('portfolio:scene-ready', start)
    if (document.querySelector('#loader')?.getAttribute('data-ready') === 'true') start()
    document.addEventListener('pointerdown', gesture)
    document.addEventListener('keydown', gesture)
    document.addEventListener('touchend', gesture)
    const detail = (event: Event) => portfolioAudio.detail(Boolean((event as CustomEvent<{ open: boolean }>).detail?.open))
    const select = () => { portfolioAudio.cue('long'); portfolioAudio.excite('particles', 1) }
    const hover = (event: Event) => {
      if (!(event.target instanceof Element)) return
      const element = event.target.closest<HTMLElement>('[data-sound], .detail-content a, .detail-content button')
      if (!element || (event instanceof PointerEvent && event.pointerType === 'touch')) return
      const related = (event as PointerEvent | FocusEvent).relatedTarget
      if (related instanceof Node && element.contains(related)) return
      const sound = element.dataset.sound || 'short'
      if (isSoundName(sound)) portfolioAudio.cue(sound)
    }
    document.addEventListener('visibilitychange', portfolioAudio.visibility)
    document.addEventListener('pointerover', hover)
    document.addEventListener('focusin', hover)
    window.addEventListener('portfolio:crystal-detail', detail)
    window.addEventListener('portfolio:social-select', select)
    return () => {
      window.removeEventListener('portfolio:scene-ready', start)
      document.removeEventListener('pointerdown', gesture)
      document.removeEventListener('keydown', gesture)
      document.removeEventListener('touchend', gesture)
      document.removeEventListener('visibilitychange', portfolioAudio.visibility)
      document.removeEventListener('pointerover', hover)
      document.removeEventListener('focusin', hover)
      window.removeEventListener('portfolio:crystal-detail', detail)
      window.removeEventListener('portfolio:social-select', select)
      portfolioAudio.dispose()
    }
  }, [])
  return state
}
