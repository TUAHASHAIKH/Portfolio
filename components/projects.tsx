export function Projects() {
  const projects = [
    {
      id: 1,
      title: 'AutoML System for Classification',
      description: 'End-to-end automated machine learning web app with 7 algorithms and hyperparameter optimization',
      tags: ['Streamlit', 'scikit-learn', 'pandas', 'Python'],
      buttons: ['Live', 'GitHub'],
      liveLink: 'https://automlnust.streamlit.app/',
      githubLink: 'https://github.com/TUAHASHAIKH/AutoML',
      image: '/images/projects/AutoML.png',
    },
    {
      id: 2,
      title: 'SecurePassFS',
      description: 'Encrypted filesystem-based password wallet with XSalsa20-Poly1305 encryption',
      tags: ['Python', 'CustomTkinter', 'Cryptography'],
      buttons: ['GitHub'],
      githubLink: 'https://github.com/TUAHASHAIKH/SecurePassFS',
      image: '/images/projects/SecurePassFS.png',
    },
    {
      id: 3,
      title: 'StraySense',
      description: 'Full-stack platform aimed at helping stray animals',
      tags: ['React', 'Node.js', 'MySQL', 'Express.js'],
      buttons: ['GitHub'],
      githubLink: 'https://github.com/TUAHASHAIKH/StraySense',
      image: '/images/projects/StraySense.png',
    },
    {
      id: 4,
      title: 'Smart Ride Application',
      description: 'Ride-sharing app with efficient data structures and algorithms',
      tags: ['DSA', 'Algorithms', 'C++'],
      buttons: ['GitHub'],
      githubLink: 'https://github.com/TUAHASHAIKH/Smart-Ride',
      image: '/images/projects/SmartRide.png',
    },
    {
      id: 5,
      title: 'AI Bot for 2048 Game',
      description: 'Intelligent game bot using Monte Carlo and Expectimax algorithms',
      tags: ['Python', 'AI', 'Monte Carlo', 'Expectimax'],
      buttons: ['GitHub'],
      image: '/images/projects/2048.png',
    },
    {
      id: 6,
      title: 'NUSTFRUTA',
      description: 'E-commerce website for NUST startup selling fruits to students',
      tags: ['PHP', 'Bootstrap', 'MySQL'],
      buttons: ['GitHub'],
      image: '/images/projects/NUSTFRUTAA.png',
    },
  ]

  return (
    <section id="projects" className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-foreground">
            <span className="text-accent">#</span>projects
            <div className="w-32 h-1 bg-accent mt-2"></div>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border border-border rounded-lg overflow-hidden hover:border-accent transition-colors flex flex-col"
            >
              {/* Project image placeholder */}
              <div className="bg-gradient-to-br from-background to-secondary h-48 flex items-center justify-center overflow-hidden">
                {project.image ? (
                  <img 
                    src={project.image} 
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-foreground/50 text-center">[Project Image Placeholder]</span>
                )}
              </div>

              <div className="p-6 border-t border-border flex flex-col flex-grow">
                <div className="flex gap-2 mb-4 flex-wrap">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-foreground/70 font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <h3 className="text-xl font-bold text-foreground mb-2">
                  {project.title}
                </h3>

                <p className="text-foreground/70 text-sm mb-6 flex-grow">
                  {project.description}
                </p>

                <div className="flex gap-3 mt-auto">
                  {project.buttons.map((btn) => (
                    <a
                      key={btn}
                      href={btn === 'Live' ? project.liveLink : project.githubLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border border-accent text-accent hover:bg-accent hover:text-accent-foreground transition-colors px-4 py-2 text-xs font-mono rounded"
                    >
                      {btn} <span className="text-accent">↔</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decorative dot pattern - left side */}
      <div className="absolute left-6 top-1/2 space-y-2 hidden lg:block">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div
                key={j}
                className="w-1.5 h-1.5 rounded-full bg-accent/30"
              ></div>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
