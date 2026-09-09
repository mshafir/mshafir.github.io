import { useRovingFocus } from '../../keyboard/useRovingFocus'
import type { Project } from '../../data/types'
import { ProjectTile } from './ProjectTile'

/**
 * Featured projects carry long, hand-written blurbs, so they get a full-width
 * row each; the rest sit in a compact grid beneath. One keyboard scope spans
 * both so arrows walk straight from the last row into the grid.
 */
export function ProjectGrid({ id, projects }: { id: string; projects: Project[] }) {
  const featured = projects.filter((project) => project.featured)
  const rest = projects.filter((project) => !project.featured)
  const ordered = [...featured, ...rest]

  const { itemRef, listProps } = useRovingFocus({
    id,
    count: ordered.length,
    label: 'project',
    grid: true,
  })

  return (
    <div className="tile-sections" {...listProps}>
      {featured.length > 0 && (
        <div className="tile-rows">
          {featured.map((project, index) => (
            <ProjectTile
              key={project.name}
              project={project}
              variant="feature"
              ref={itemRef(index)}
            />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="tile-grid">
          {rest.map((project, index) => (
            <ProjectTile
              key={project.name}
              project={project}
              ref={itemRef(featured.length + index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
