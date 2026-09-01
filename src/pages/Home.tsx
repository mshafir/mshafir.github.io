import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { VoxelPortrait } from '../components/VoxelPortrait/VoxelPortrait'
import { ProjectGrid } from '../components/ProjectTile/ProjectGrid'
import { PostList } from '../components/PostList/PostList'
import { allPosts } from '../content/posts'
import projectData from '../data/projects.json'
import type { Project } from '../data/types'
import './pages.css'

const projects = projectData as Project[]

export default function Home() {
  const featured = projects.filter((project) => project.featured).slice(0, 6)
  const latest = allPosts.slice(0, 3)

  return (
    <div className="page">
      <Seo
        title="Home"
        description="Michael Shafir — software architect. Building with AI, writing about the systems underneath."
        path="/"
      />

      <section className="hero">
        <div>
          <p className="hero__role">Software Architect</p>
          <h1 className="hero__name">Michael Shafir</h1>
          <p className="hero__blurb">
            I design and build software systems, and I write about what happens when you put
            language models inside them.
          </p>
          <div className="hero__links">
            <a className="hero__link" href="https://github.com/mshafir">
              github
            </a>
            <Link className="hero__link" to="/writing">
              writing
            </Link>
            <Link className="hero__link" to="/about">
              about
            </Link>
          </div>
        </div>
        <div className="hero__portrait">
          <VoxelPortrait />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Selected projects</h2>
          <Link className="section__link" to="/projects">
            all projects →
          </Link>
        </div>
        <ProjectGrid id="home-projects" projects={featured} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Latest writing</h2>
          <Link className="section__link" to="/writing">
            all posts →
          </Link>
        </div>
        <PostList id="home-posts" posts={latest} />
      </section>
    </div>
  )
}
