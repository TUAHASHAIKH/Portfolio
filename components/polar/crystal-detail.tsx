'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { portfolioProjects, portfolioSkills } from './portfolio-content'
import { SOCIAL_LINKS } from './social-links'
import type { CrystalKind } from './journey'
import { smoothDetailScroll } from './detail-scroll'
import './crystal-detail.css'

const titles = { skills: 'Skills', projects: 'Selected Projects', about: 'About Me' }
const indices = { skills: '01', projects: '02', about: '03' }

// The detail layer is a native modal rather than another scroll destination.
// Its portal escapes readout opacity, keeps focus trapped, and leaves the live
// WebGL sculpture visible beneath the dark atmosphere.
export function CrystalDetail({ kind }: { kind: CrystalKind }) {
  const [mounted, setMounted] = useState(false)
  const [gallery, setGallery] = useState(true)
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
      setGallery(true)
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
  return createPortal(<dialog ref={dialog} className={`crystal-detail detail-${kind === 'projects' && !gallery ? 'project-summary' : kind}`} aria-labelledby={`${kind}-detail-heading`}
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header className="detail-chrome">
      <img className="detail-wordmark" src="/images/tuaha-wordmark.svg" alt="Tuaha" width={530} height={88} />
      <button type="button" className="detail-close" onClick={close} aria-label={`Close ${titles[kind]}`}>Close<span aria-hidden="true" /></button>
    </header>
    <article className="detail-content">
      <p className="detail-eyebrow">{kind === 'projects' && gallery ? `PORTFOLIO_CO_${indices[kind]}` : `////// ${kind === 'skills' ? 'Skills' : 'Summary'}`}</p>
      <h2 ref={heading} tabIndex={-1} id={`${kind}-detail-heading`} className={kind === 'projects' && gallery ? 'detail-heading' : 'sr-only'}>{titles[kind]}</h2>
      {kind === 'skills' ? <dl className="detail-skills">
        {portfolioSkills.map(category => <div key={category.title}><dt>{category.title}</dt><dd>{category.skills.join(', ')}.</dd></div>)}
      </dl> : kind === 'about' ? <>
        <p>I’m Tuaha Shaikh, a Computer Science student at the National University of Sciences and Technology (NUST), Islamabad. I specialize in full-stack development, machine learning, and building solutions to real-world problems.</p>
        <p>My work ranges from automated machine learning and intelligent game agents to full-stack web applications and secure desktop tools. I enjoy turning ideas into working software, learning new technologies, and contributing to projects that make a difference.</p>
        <p className="detail-eyebrow">/// Discover</p>
        <div className="detail-links">{SOCIAL_LINKS.slice(0, 2).map(link => <a key={link.name} href={link.href} target="_blank" rel="noopener noreferrer">[{link.name.toLowerCase()}] ↗</a>)}</div>
        <p className="detail-eyebrow">/// Get in touch</p>
        <div className="detail-links">{SOCIAL_LINKS.slice(2).map(link => <a key={link.name} href={link.href} target={link.name === 'Gmail' ? undefined : '_blank'} rel="noopener noreferrer">[{link.name.toLowerCase()}] ↗</a>)}</div>
      </> : !gallery ? <>
        <p>Selected work across machine learning, full-stack applications, security, and intelligent systems. Explore the gallery for application screenshots, source code, and a live demo.</p>
        <p className="detail-eyebrow">/// Discover</p>
        <div className="detail-links"><button className="detail-gallery-toggle" onClick={() => { setGallery(true); dialog.current?.scrollTo(0, 0) }}>[Explore all six projects] ↗</button></div>
        <p className="detail-eyebrow">/// Visit</p>
        <div className="detail-links"><a href="https://automlnust.streamlit.app/" target="_blank" rel="noopener noreferrer">[AutoML demo] ↗</a><a href="https://github.com/TUAHASHAIKH?tab=repositories" target="_blank" rel="noopener noreferrer">[Repositories] ↗</a></div>
      </> : <>
        {/* The gallery can return to the project summary without leaving the
            crystal. The outer close still returns to the scrolling journey. */}
        <button className="detail-gallery-back" onClick={() => { setGallery(false); dialog.current?.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }) }}>[ CLOSE GALLERY ]</button>
        <p className="detail-project-intro">Selected work in machine learning, full-stack development, security, and intelligent systems.</p>
        <div className="detail-project-grid">
          {portfolioProjects.map(project => <section className="detail-project" key={project.id}>
            <a className="detail-project-image" href={project.githubLink} target="_blank" rel="noopener noreferrer" aria-label={`View ${project.title} on GitHub`}>
              <img src={project.image} alt={`${project.title} application screenshot`} width={720} height={450} loading="lazy" decoding="async" />
              <span>{project.tags[0]}</span>
            </a>
            <div className="detail-project-copy"><h3><a href={project.githubLink} target="_blank" rel="noopener noreferrer">{project.title}<span aria-hidden="true">↗</span></a></h3>
              <p>{project.description}.</p><p className="detail-project-tags">{project.tags.join(' / ')}</p>
              <div className="detail-links"><a href={project.githubLink} target="_blank" rel="noopener noreferrer">[GitHub] ↗</a>{'liveLink' in project && <a href={project.liveLink} target="_blank" rel="noopener noreferrer">[Live demo] ↗</a>}</div>
            </div>
          </section>)}
        </div>
      </>}
    </article>
    <button type="button" className="detail-sound" onClick={() => document.querySelector<HTMLButtonElement>('.sound-toggle')?.click()}>Sound: <SoundState /></button>
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
