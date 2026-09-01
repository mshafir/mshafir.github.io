import { Seo } from '../components/Seo'
import { ProjectGrid } from '../components/ProjectTile/ProjectGrid'
import projectData from '../data/projects.json'
import type { Project } from '../data/types'
import './pages.css'

const projects = projectData as Project[]

export default function Projects() {
  return (
    <div className="page">
      <Seo
        title="Projects"
        description="Open source projects by Michael Shafir — AI tooling, React libraries, and visualization."
        path="/projects"
      />
      <h1 className="page__title">Projects</h1>
      <p className="page__lede">
        Open source, pulled from GitHub. Mostly libraries I wanted to exist and experiments that
        got out of hand.
      </p>
      <ProjectGrid id="all-projects" projects={projects} />
    </div>
  )
}
