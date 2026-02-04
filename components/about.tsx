export function About() {
  return (
    <section id="about-me" className="py-20 px-6 relative">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-bold text-foreground mb-12">
          <span className="text-accent">#</span>about-me
          <div className="w-44 h-1 bg-accent mt-2"></div>
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left content */}
          <div className="space-y-6">
            <div>
              <p className="text-foreground text-lg mb-4">Hello, i'm Tuaha!</p>
              <p className="text-foreground/80 leading-relaxed">
                I'm a 6th semester Computer Science student at National University of
                Science and Technology (NUST), Islamabad. I specialize in full-stack
                development, machine learning, and building innovative solutions.
              </p>
            </div>

            <p className="text-foreground/80 leading-relaxed">
              I have experience working on diverse projects from machine learning
              applications to full-stack web development. My passion lies in creating
              innovative solutions and leveraging modern technologies to solve real-world
              problems. I'm always eager to learn new technologies and contribute to
              impactful projects.
            </p>
          </div>

          {/* Right side - Image placeholder with decorative elements */}
          <div className="relative h-96 flex items-center justify-center">
            {/* Profile image placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-80 bg-gradient-to-br from-background to-secondary border border-border rounded-lg overflow-hidden">
                <img 
                  src="/images/profile/DSC05762.JPG" 
                  alt="Tuaha's profile" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Decorative dot pattern - right side */}
            <div className="absolute right-0 top-0 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="w-1.5 h-1.5 rounded-full bg-accent"
                    ></div>
                  ))}
                </div>
              ))}
            </div>

            {/* Bottom decorative lines */}
            <div className="absolute bottom-0 right-1/4 w-32 h-1 bg-gradient-to-r from-accent to-transparent"></div>
          </div>
        </div>
      </div>

      {/* Left side decorative border */}
      <div className="absolute left-0 top-1/4 bottom-1/4 border-l border-border hidden lg:block"></div>
    </section>
  )
}
