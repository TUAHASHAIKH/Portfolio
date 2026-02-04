'use client'

import { ThemeToggle } from './theme-toggle'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export function Header() {
  const [activeSection, setActiveSection] = useState('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenuOpen(false) // Close mobile menu after clicking
  }

  useEffect(() => {
    const sections = ['home', 'projects', 'skills', 'about-me', 'contacts']
    
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        const visibleEntries = entries.filter(entry => entry.isIntersecting)
        if (visibleEntries.length > 0) {
          const mostVisible = visibleEntries.reduce((prev, current) => 
            current.intersectionRatio > prev.intersectionRatio ? current : prev
          )
          setActiveSection(mostVisible.target.id)
        }
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        rootMargin: '-20% 0px -35% 0px'
      }
    )

    sections.forEach((id) => {
      const element = document.getElementById(id)
      if (element) {
        observer.observe(element)
      }
    })

    return () => {
      sections.forEach((id) => {
        const element = document.getElementById(id)
        if (element) {
          observer.unobserve(element)
        }
      })
    }
  }, [])

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <button 
          onClick={() => scrollToSection('home')} 
          className="text-xl font-bold text-foreground hover:text-accent transition-colors z-50"
        >
          ⬜ Tuaha
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            onClick={() => scrollToSection('home')}
            className={`${
              activeSection === 'home' 
                ? 'text-accent' 
                : 'text-foreground hover:text-accent'
            } transition-colors text-sm`}
          >
            #home
          </button>
          <button
            onClick={() => scrollToSection('projects')}
            className={`${
              activeSection === 'projects' 
                ? 'text-accent' 
                : 'text-foreground hover:text-accent'
            } transition-colors text-sm`}
          >
            #projects
          </button>
          <button
            onClick={() => scrollToSection('skills')}
            className={`${
              activeSection === 'skills' 
                ? 'text-accent' 
                : 'text-foreground hover:text-accent'
            } transition-colors text-sm`}
          >
            #skills
          </button>
          <button
            onClick={() => scrollToSection('about-me')}
            className={`${
              activeSection === 'about-me' 
                ? 'text-accent' 
                : 'text-foreground hover:text-accent'
            } transition-colors text-sm`}
          >
            #about-me
          </button>
          <button
            onClick={() => scrollToSection('contacts')}
            className={`${
              activeSection === 'contacts' 
                ? 'text-accent' 
                : 'text-foreground hover:text-accent'
            } transition-colors text-sm`}
          >
            #contacts
          </button>
          <ThemeToggle />
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-4 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-foreground hover:text-accent transition-colors z-50"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <nav className="absolute top-full left-0 right-0 bg-background/95 backdrop-blur-sm border-b border-border md:hidden">
            <div className="flex flex-col px-6 py-4 space-y-4">
              <button
                onClick={() => scrollToSection('home')}
                className={`${
                  activeSection === 'home' 
                    ? 'text-accent' 
                    : 'text-foreground hover:text-accent'
                } transition-colors text-sm text-left`}
              >
                #home
              </button>
              <button
                onClick={() => scrollToSection('projects')}
                className={`${
                  activeSection === 'projects' 
                    ? 'text-accent' 
                    : 'text-foreground hover:text-accent'
                } transition-colors text-sm text-left`}
              >
                #projects
              </button>
              <button
                onClick={() => scrollToSection('skills')}
                className={`${
                  activeSection === 'skills' 
                    ? 'text-accent' 
                    : 'text-foreground hover:text-accent'
                } transition-colors text-sm text-left`}
              >
                #skills
              </button>
              <button
                onClick={() => scrollToSection('about-me')}
                className={`${
                  activeSection === 'about-me' 
                    ? 'text-accent' 
                    : 'text-foreground hover:text-accent'
                } transition-colors text-sm text-left`}
              >
                #about-me
              </button>
              <button
                onClick={() => scrollToSection('contacts')}
                className={`${
                  activeSection === 'contacts' 
                    ? 'text-accent' 
                    : 'text-foreground hover:text-accent'
                } transition-colors text-sm text-left`}
              >
                #contacts
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
