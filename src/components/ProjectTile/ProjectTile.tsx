import { forwardRef, useState } from 'react'
import type { Project } from '../../data/types'
import { MatrixRain } from './MatrixRain'
import './ProjectTile.css'

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Python: '#3572A5',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Java: '#B07219',
  Go: '#00ADD8',
  Rust: '#DEA584',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

type Variant = 'tile' | 'feature'

export const ProjectTile = forwardRef<HTMLAnchorElement, { project: Project; variant?: Variant }>(
  function ProjectTile({ project, variant = 'tile' }, ref) {
    const [active, setActive] = useState(false)
    const feature = variant === 'feature'

    const meta = (
      <div className="tile__meta">
        {project.language && (
          <span className="tile__chip">
            <span
              className="tile__dot"
              style={{ background: LANGUAGE_COLORS[project.language] ?? 'var(--dim)' }}
            />
            {project.language}
          </span>
        )}
        <span className="tile__chip" title={`${project.stars} stars`}>
          <span aria-hidden="true">★</span>
          {project.stars}
        </span>
        <span className="tile__chip tile__chip--date">{formatDate(project.pushedAt)}</span>
      </div>
    )

    return (
      <a
        ref={ref}
        className={feature ? 'tile tile--feature' : 'tile'}
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        // Keyboard focus drives the same intensity change as hover, so
        // keyboard users get identical feedback.
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <MatrixRain active={active} />
        {feature ? (
          // Name and meta form a narrow left column; the blurb gets the rest
          // of the width so long prose reads at a comfortable measure.
          <div className="tile__body tile__body--feature">
            <div className="tile__head">
              <h3 className="tile__name">{project.name}</h3>
              {meta}
            </div>
            {project.blurb && <p className="tile__blurb">{project.blurb}</p>}
          </div>
        ) : (
          <div className="tile__body">
            <h3 className="tile__name">{project.name}</h3>
            {project.blurb && <p className="tile__blurb">{project.blurb}</p>}
            {meta}
          </div>
        )}
      </a>
    )
  },
)
