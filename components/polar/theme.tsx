'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const apply = (value: boolean) => {
      document.documentElement.dataset.theme = value ? 'dark' : 'light'
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value ? '#060d19' : '#a0a5b1')
      window.dispatchEvent(new Event('portfolio:theme'))
    }
    const sync = () => {
      const value = document.documentElement.dataset.theme === 'dark'
      setDark(value)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value ? '#060d19' : '#a0a5b1')
    }
    const storage = (event: StorageEvent) => {
      if (event.key === 'portfolio-theme' || event.key === null) apply(event.newValue === 'dark')
    }
    sync()
    window.addEventListener('portfolio:theme', sync)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener('portfolio:theme', sync); window.removeEventListener('storage', storage) }
  }, [])
  const toggle = () => {
    const next = !dark
    try { localStorage.setItem('portfolio-theme', next ? 'dark' : 'light') } catch {}
    document.documentElement.dataset.theme = next ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#060d19' : '#a0a5b1')
    window.dispatchEvent(new Event('portfolio:theme'))
  }
  return <button type="button" className="theme-toggle" aria-label="Dark mode" aria-pressed={dark} onClick={toggle}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z"/><path d="M17 3v4m-2-2h4"/></svg>
    <span className="theme-day">Daylight</span><span className="theme-night">Nightfall</span><i aria-hidden="true" />
  </button>
}
