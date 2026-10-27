// Content carried over from the original portfolio; scene styling stays separate.
export const portfolioProjects = [
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
      githubLink: 'https://github.com/TUAHASHAIKH/2048-Ai-Game-Bot',
      image: '/images/projects/2048.png',
    },
    {
      id: 6,
      title: 'NUSTFRUTA',
      description: 'E-commerce website for NUST startup selling fruits to students',
      tags: ['PHP', 'Bootstrap', 'MySQL'],
      buttons: ['GitHub'],
      githubLink: 'https://github.com/TUAHASHAIKH/NustFruta',
      image: '/images/projects/NUSTFRUTAA.png',
    },
  ] as const

export const portfolioSkills = [
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
  ] as const
