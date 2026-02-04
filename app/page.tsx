import { Header } from '@/components/header'
import { Hero } from '@/components/hero'
import { Projects } from '@/components/projects'
import { Skills } from '@/components/skills'
import { About } from '@/components/about'
import { Contacts } from '@/components/contacts'
import { Footer } from '@/components/footer'

export default function Home() {
  return (
    <main className="bg-background text-foreground overflow-hidden">
      <Header />
      <Hero />
      <Projects />
      <Skills />
      <About />
      <Contacts />
      <Footer />
    </main>
  )
}
