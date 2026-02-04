export function Skills() {
  const skillCategories = [
    {
      title: 'Languages',
      skills: ['C', 'C++', 'Java', 'Python', 'PHP', 'JavaScript', 'HTML', 'CSS', 'Assembly'],
    },
    {
      title: 'Frameworks',
      skills: ['React.js', 'Node.js', 'Express.js', 'Django', 'Bootstrap', 'Streamlit'],
    },
    {
      title: 'Databases',
      skills: ['MySQL', 'MongoDB', 'PL/SQL'],
    },
    {
      title: 'ML/Data Science',
      skills: ['scikit-learn', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'plotly'],
    },
    {
      title: 'Other',
      skills: ['CustomTkinter', 'Cryptography', 'Problem Solving', 'Critical Thinking'],
    },
  ]

  return (
    <section className="py-20 px-6 relative" id="skills">
      <div className="max-w-7xl mx-auto">
        <div className="relative mb-12">
          <h2 className="text-3xl font-bold text-foreground inline-flex items-center gap-4">
            <span className="text-accent">#</span>skills
            <div className="w-32 sm:w-44 lg:w-64 h-px bg-accent"></div>
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left side - Decorative elements */}
          <div className="hidden lg:flex flex-col gap-12 pt-8">
            {/* Top dot pattern */}
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="w-1 h-1 rounded-full bg-accent/60"
                    ></div>
                  ))}
                </div>
              ))}
            </div>

            {/* Overlapping rectangles */}
            <div className="relative w-48 h-48 ml-16">
              <div className="absolute top-0 left-0 border border-accent w-32 h-32"></div>
              <div className="absolute top-8 left-8 border border-accent w-32 h-32"></div>
              <div className="absolute bottom-0 right-0 border border-accent w-24 h-24"></div>
            </div>

            {/* Center dot pattern */}
            <div className="space-y-2 ml-32">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div
                      key={j}
                      className="w-1 h-1 rounded-full bg-accent/60"
                    ></div>
                  ))}
                </div>
              ))}
            </div>

            {/* Small squares */}
            <div className="flex gap-8 ml-48">
              <div className="border border-accent w-20 h-20"></div>
              <div className="border border-accent w-16 h-16"></div>
            </div>
          </div>

          {/* Right side - Skills grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {skillCategories.map((category) => (
              <div
                key={category.title}
                className="border border-foreground/20"
              >
                <h3 className="text-base font-bold text-foreground border-b border-foreground/20 px-3 py-2">
                  {category.title}
                </h3>
                <div className="px-3 py-3 space-y-1">
                  {category.skills.map((skill, idx) => (
                    <p key={idx} className="text-foreground/70 text-sm">
                      {skill}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
