'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { portfolioProjects, portfolioSkills } from './portfolio-content'
import { SOCIAL_LINKS } from './social-links'
import type { CrystalKind } from './journey'
import { smoothDetailScroll } from './detail-scroll'
import './crystal-detail.css'

const titles = { skills: 'Skills', projects: 'Selected Projects', about: 'About Me' }

// The detail layer is a native modal rather than another scroll destination.
// Its portal escapes readout opacity, keeps focus trapped, and leaves the live
// WebGL sculpture visible beneath the dark atmosphere.
export function CrystalDetail({ kind }: { kind: CrystalKind }) {
  const [mounted, setMounted] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restore = useRef<(() => void) | null>(null)
  const opener = useRef<HTMLElement | null>(null)

  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    dialog.current?.close()
    restore.current?.()
    restore.current = null
    document.querySelector('#app')?.removeAttribute('data-detail')
    opener.current?.focus({ preventScroll: true })
  }, [])

  const close = useCallback(() => {
    const element = dialog.current
    if (!element?.open || element.dataset.phase === 'closing') return
    // Keep the top layer and scroll lock alive until the sculpture has returned.
    // Escape and the close button follow this same reversible animation path.
    element.dataset.phase = 'closing'
    window.dispatchEvent(new CustomEvent('portfolio:crystal-detail', { detail: { kind, open: false } }))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish()
    else timer.current = setTimeout(finish, 950)
  }, [finish, kind])

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (mounted && dialog.current) return smoothDetailScroll(dialog.current)
  }, [mounted])
  useEffect(() => {
    const open = () => {
      const element = dialog.current
      // A second click must not start another animation, lock, or timer.
      if (!element || document.querySelector('dialog[open]')) return
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      window.dispatchEvent(new CustomEvent('portfolio:center-crystal', { detail: { kind, explicit: true } }))
      const progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const overflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      restore.current = () => {
        document.documentElement.style.overflow = overflow
        const distance = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo({ top: progress * distance, behavior: 'instant' })
      }
      document.querySelector('#app')?.setAttribute('data-detail', kind)
      element.dataset.phase = 'opening'
      element.showModal()
      element.scrollTop = 0
      heading.current?.focus({ preventScroll: true })
      window.dispatchEvent(new CustomEvent('portfolio:crystal-detail', { detail: { kind, open: true } }))
    }
    const name = `portfolio:open-${kind}`
    window.addEventListener(name, open)
    return () => {
      window.removeEventListener(name, open)
      if (timer.current) clearTimeout(timer.current)
      if (restore.current) {
        window.dispatchEvent(new CustomEvent('portfolio:crystal-detail', { detail: { kind, open: false } }))
        restore.current?.()
        restore.current = null
        document.querySelector('#app')?.removeAttribute('data-detail')
      }
    }
  }, [kind, mounted])

  if (!mounted) return null
  return createPortal(<dialog ref={dialog} className={`crystal-detail detail-${kind}`} aria-labelledby={`${kind}-detail-heading`}
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header className="detail-chrome">
      <img className="detail-wordmark" data-glitch-trigger data-sound="logo" src="/images/tuaha-wordmark.svg" alt="Tuaha" width={530} height={88} />
      <button type="button" className="detail-close" data-glitch-trigger data-sound="short" onClick={close} aria-label={`Close ${titles[kind]}`}>Close<span aria-hidden="true" /></button>
    </header>
    <article className="detail-content">
      <p className="detail-eyebrow">{`////// ${kind === 'skills' ? 'Skills' : kind === 'projects' ? 'Projects' : 'Summary'}`}</p>
      <h2 ref={heading} tabIndex={-1} id={`${kind}-detail-heading`} className="sr-only">{titles[kind]}</h2>
      {kind === 'skills' ? <dl className="detail-skills">
        {portfolioSkills.map(category => <div key={category.title}><dt>{category.title}</dt><dd>{category.skills.join(', ')}.</dd></div>)}
      </dl> : kind === 'about' ? <>
        <p>I’m Tuaha Shaikh, a Computer Science student at the National University of Sciences and Technology (NUST), Islamabad. I specialize in full-stack development, machine learning, and building solutions to real-world problems.</p>
        <p>My work ranges from automated machine learning and intelligent game agents to full-stack web applications and secure desktop tools. I enjoy turning ideas into working software, learning new technologies, and contributing to projects that make a difference.</p>
        <p className="detail-eyebrow">/// Discover</p>
        <div className="detail-links">{SOCIAL_LINKS.slice(0, 2).map(link => <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer">[{link.name.toLowerCase()}] ↗</a>)}</div>
        <p className="detail-eyebrow">/// Get in touch</p>
        <div className="detail-links">{SOCIAL_LINKS.slice(2).map(link => <a key={link.name} href={link.href} target={link.name === 'Gmail' ? undefined : '_blank'} rel="noopener noreferrer">[{link.name.toLowerCase()}] ↗</a>)}</div>
      </> : <>
        <p className="detail-project-intro">Selected work in AI tooling, desktop software, computer vision, full-stack development, and systems engineering.</p>
        <div className="detail-project-grid" aria-label="Selected projects">
          {portfolioProjects.map(project => <section className="detail-project" key={project.id}>
            <a className="detail-project-image" href={project.githubLink} target="_blank" rel="noopener noreferrer" aria-label={`View ${project.title} on GitHub`}>
              <img src={project.image} alt={project.imageAlt} width={1600} height={1000} srcSet={`${project.image.replace('.webp', '-800.webp')} 800w, ${project.image} 1600w`} sizes="(max-width: 688px) calc(100vw - 48px), 640px" loading="lazy" decoding="async" />
            </a>
            <div className="detail-project-copy"><h3><a href={project.githubLink} target="_blank" rel="noopener noreferrer">{project.title}<span aria-hidden="true">↗</span></a></h3>
              <p>{project.description}.</p><p className="detail-project-tags">{project.tags.join(' / ')}</p>
              <div className="detail-links"><a href={project.githubLink} target="_blank" rel="noopener noreferrer">[GitHub] ↗</a>{'liveLink' in project && <a href={project.liveLink} target="_blank" rel="noopener noreferrer">[Live demo] ↗</a>}</div>
            </div>
          </section>)}
        </div>
      </>}
    </article>
    <button type="button" className="detail-sound" data-glitch-trigger data-sound="short" onClick={() => document.querySelector<HTMLButtonElement>('.sound-toggle')?.click()}>Sound: <SoundState /></button>
  </dialog>, document.body)
}

// Mirror the real sound control; do not create a second audio element or reset
// the user's sound preference when entering and leaving a crystal.
function SoundState() {
  const [sound, setSound] = useState(false)
  useEffect(() => {
    const button = document.querySelector('.sound-toggle')
    const update = () => setSound(button?.getAttribute('aria-pressed') === 'true')
    const observer = new MutationObserver(update)
    if (button) observer.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] })
    update()
    return () => observer.disconnect()
  }, [])
  return <>{sound ? 'On' : 'Off'}</>
}
