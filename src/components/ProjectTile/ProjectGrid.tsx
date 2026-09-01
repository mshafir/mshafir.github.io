import { useRovingFocus } from '../../keyboard/useRovingFocus'
import type { Project } from '../../data/types'
import { ProjectTile } from './ProjectTile'

export function ProjectGrid({ id, projects }: { id: string; projects: Project[] }) {
  const { itemRef } = useRovingFocus({ id, count: projects.length, label: 'project' })

  return (
    <div className="tile-grid">
      {projects.map((project, index) => (
        <ProjectTile key={project.name} project={project} ref={itemRef(index)} />
      ))}
    </div>
  )
}
