'use client'

import { useEffect } from 'react'
import { portfolioAudio } from './audio-engine'

// Short, local block reveals echo the reference's texture-driven UI shader.
// Animate the existing text rather than scrambling DOM text or live regions.
export function GlitchEffects() {
  useEffect(() => {
    const app = document.querySelector('#app')
    if (!app) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations = new Map<Element, Animation>()
    const played = new WeakMap<Element, number>()
    let introduced = false, crystal = 'none', contact = false, beep = 0
    const glitch = (element: Element, reveal = false, delay = 0) => {
      if (preference.matches || document.hidden) return
      if (performance.now() - (played.get(element) ?? -Infinity) < 250) return
      played.set(element, performance.now())
      animations.get(element)?.cancel()
      const shift = (Math.random() > .5 ? 1 : -1) * 2
      const base = getComputedStyle(element).transform
      const translate = (offset: number) => `${base === 'none' ? '' : base} translateX(${offset}px)`
      const animation = element.animate([
        { clipPath: reveal ? 'inset(0 100% 0 0)' : 'inset(0)', transform: translate(-shift), opacity: .8, offset: 0 },
        { clipPath: 'polygon(0 0,100% 0,100% 31%,76% 31%,76% 45%,100% 45%,100% 100%,0 100%,0 70%,19% 70%,19% 56%,0 56%)', transform: translate(shift), opacity: .9, offset: .22 },
        { clipPath: 'inset(0)', transform: translate(0), opacity: 1, offset: .45 },
        { clipPath: 'polygon(0 0,100% 0,100% 58%,86% 58%,86% 74%,100% 74%,100% 100%,0 100%,0 40%,12% 40%,12% 28%,0 28%)', transform: translate(-shift * .5), opacity: .86, offset: .65 },
        { clipPath: 'inset(0)', transform: translate(0), opacity: 1, offset: 1 },
      ], { duration: reveal ? 650 : 250, delay, easing: 'steps(1,end)' })
      animations.set(element, animation)
      animation.onfinish = () => { animation.cancel(); if (animations.get(element) === animation) animations.delete(element) }
    }
    const reveal = (selector: string) => document.querySelectorAll(selector).forEach((element, index) => glitch(element, true, index * 70))
    const update = () => {
      const ready = app.getAttribute('data-introduced') === 'true'
      if (ready && !introduced) {
        reveal('.identity .role,.identity .specialties,.intro p,.bottom-bar .sound-toggle')
        portfolioAudio.cue('logo'); portfolioAudio.cue('manifesto')
      }
      introduced = ready
      const next = app.getAttribute('data-active-crystal') || 'none'
      if (next !== crystal && next !== 'none' && !app.hasAttribute('data-detail')) {
        reveal(`[data-crystal="${next}"] .crystal-title,[data-crystal="${next}"] .crystal-temperature,[data-crystal="${next}"] .crystal-explore`)
        portfolioAudio.cue((['beeps', 'beeps2', 'beeps3'] as const)[beep++ % 3])
      }
      crystal = next
      const connected = app.getAttribute('data-contact-interactive') === 'true'
      if (connected && !contact) { reveal('.social-arrow svg,.social-selector'); portfolioAudio.cue('long') }
      contact = connected
    }
    const hover = (event: Event) => {
      if (!(event.target instanceof Element)) return
      if (event instanceof PointerEvent && event.pointerType === 'touch') return
      const element = event.target.closest('[data-glitch-trigger], .detail-content a, .detail-content button')
      const related = (event as PointerEvent | FocusEvent).relatedTarget
      if (!element || (related instanceof Node && element.contains(related))) return
      glitch(element.querySelector('[data-glitch-content]') || element)
    }
    const select = () => reveal('.social-selector .social-current span,.social-neighbor')
    const detail = (event: Event) => {
      if ((event as CustomEvent<{ open: boolean }>).detail?.open) reveal('dialog[open] .detail-eyebrow,dialog[open] .detail-heading')
    }
    const stop = () => { animations.forEach(animation => animation.cancel()); animations.clear() }
    const observer = new MutationObserver(update)
    observer.observe(app, { attributes: true, attributeFilter: ['data-introduced', 'data-active-crystal', 'data-contact-interactive', 'data-detail'] })
    document.addEventListener('pointerover', hover)
    document.addEventListener('focusin', hover)
    document.addEventListener('visibilitychange', stop)
    window.addEventListener('portfolio:social-select', select)
    window.addEventListener('portfolio:crystal-detail', detail)
    preference.addEventListener('change', stop)
    update()
    return () => {
      stop(); observer.disconnect()
      document.removeEventListener('pointerover', hover)
      document.removeEventListener('focusin', hover)
      document.removeEventListener('visibilitychange', stop)
      window.removeEventListener('portfolio:social-select', select)
      window.removeEventListener('portfolio:crystal-detail', detail)
      preference.removeEventListener('change', stop)
    }
  }, [])
  return null
}
