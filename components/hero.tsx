'use client'

export function Hero() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="home" className="min-h-screen flex items-center pt-20 px-6 relative">
      {/* Social Links - Top Left */}
      <div className="absolute left-8 top-8 hidden lg:flex flex-col items-center gap-6 z-10">
        {/* Vertical Line */}
        <div className="w-px h-32 bg-border"></div>
        
        {/* Social Icons */}
        <a 
          href="https://github.com/TUAHASHAIKH" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-foreground/60 hover:text-accent transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
            <path d="M9 18c-4.51 2-5-2-7-2" />
          </svg>
        </a>
        
        <a 
          href="https://www.linkedin.com/in/tuaha-shaikh-b7122526a" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-foreground/60 hover:text-accent transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
            <rect width="4" height="12" x="2" y="9" />
            <circle cx="4" cy="4" r="2" />
          </svg>
        </a>
      </div>

      <div className="max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative">
          {/* Left side - Text */}
          <div className="space-y-8">
            <div className="space-y-2">
              <h1 className="text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Tuaha is a <span className="text-accent">software engineer</span> and
              </h1>
              <h1 className="text-4xl lg:text-5xl font-bold text-accent leading-tight">
                full-stack developer
              </h1>
            </div>
            
            <p className="text-foreground/80 text-base leading-relaxed">
              He builds innovative solutions in AI/ML and web development
            </p>

            <button 
              onClick={() => scrollToSection('contacts')}
              className="border border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors px-6 py-3 text-sm"
            >
              Contact me !!
            </button>
          </div>

          {/* Right side - Image and decorative elements */}
          <div className="space-y-8">
            <div className="relative h-96 flex items-center justify-center">
              {/* Decorative geometric shapes - Top left, near image */}
              <div className="absolute left-12 top-0 z-10">
                {/* Top horizontal rectangle */}
                <div className="border border-accent w-44 h-32 mb-2"></div>

                {/* Bottom group of overlapping rectangles */}
                <div className="relative w-48 h-36">
                  {/* Left vertical rectangle */}
                  <div className="absolute border border-accent w-32 h-36 top-0 left-0"></div>
                  {/* Right rectangle - shifted and overlapping */}
                  <div className="absolute border border-accent w-28 h-28 top-8 left-20"></div>
                </div>
              </div>

              {/* Image placeholder */}
              <div className="w-96 h-96 flex items-center justify-center relative z-20 transition-all duration-300 hover:-translate-y-2 hover:scale-105 cursor-pointer group">
                <img 
                  src="/images/profile/1st pic.png" 
                  alt="Tuaha's profile" 
                  className="w-full h-full object-contain mix-blend-lighten transition-all duration-300 group-hover:brightness-110"
                  style={{ background: 'transparent' }}
                />
                {/* Subtle shadow on hover */}
                <div className="absolute inset-0 -z-10 bg-accent/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
              </div>

              {/* Dot patterns - Bottom right, near image */}
              <div className="absolute right-32 bottom-20 space-y-2 z-30">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div
                        key={j}
                        className="w-1.5 h-1.5 rounded-full bg-accent/60"
                      ></div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Status badge */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 border border-accent bg-background px-4 py-2 flex items-center gap-2 text-sm z-30">
                <div className="w-3 h-3 bg-accent rounded-sm"></div>
                <span className="text-foreground">Available for work</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quote section - Centered below main content */}
        <div className="max-w-3xl mx-auto mt-20">
          <div className="border-2 border-foreground/20 rounded p-8 relative bg-background">
            <div className="absolute -top-6 -left-6 text-6xl text-foreground/20 font-serif">"</div>
            <p className="text-xl text-foreground leading-relaxed">
              With great power comes great electricity bill
            </p>
            <div className="flex justify-end mt-6">
              <div className="border border-foreground/20 px-6 py-2">
                <p className="text-foreground text-sm">- Dr. Who</p>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 text-6xl text-foreground/20 font-serif">"</div>
          </div>
        </div>
      </div>
    </section>
  )
}
