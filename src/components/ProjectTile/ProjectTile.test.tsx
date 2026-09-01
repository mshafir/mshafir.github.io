import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KeyboardProvider } from '../../keyboard/KeyboardProvider'
import { ProjectGrid } from './ProjectGrid'
import type { Project } from '../../data/types'

const projects: Project[] = [
  {
    name: 'reactlit',
    url: 'https://github.com/mshafir/reactlit',
    blurb: 'Faster React apps.',
    language: 'TypeScript',
    stars: 12,
    pushedAt: '2025-04-25T00:00:00Z',
    featured: true,
  },
  {
    name: 'vislib',
    url: 'https://github.com/mshafir/vislib',
    blurb: '',
    language: null,
    stars: 3,
    pushedAt: '2018-06-07T00:00:00Z',
    featured: false,
  },
]

const setup = () =>
  render(
    <MemoryRouter>
      <KeyboardProvider>
        <ProjectGrid id="test-grid" projects={projects} />
      </KeyboardProvider>
    </MemoryRouter>,
  )

describe('ProjectGrid', () => {
  it('renders one link per project, pointing at the repo', () => {
    setup()
    expect(screen.getByRole('link', { name: /reactlit/ })).toHaveAttribute(
      'href',
      'https://github.com/mshafir/reactlit',
    )
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('shows the blurb, language, and star count', () => {
    setup()
    expect(screen.getByText('Faster React apps.')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('omits the language chip when a repo has no language', () => {
    setup()
    expect(screen.getByRole('link', { name: /vislib/ }).textContent).not.toContain('null')
  })

  it('hides the decorative rain canvas from assistive tech', () => {
    const { container } = setup()
    const canvases = container.querySelectorAll('canvas')
    expect(canvases).toHaveLength(2)
    canvases.forEach((canvas) => expect(canvas).toHaveAttribute('aria-hidden', 'true'))
  })

  it('marks external links safe', () => {
    setup()
    screen.getAllByRole('link').forEach((link) => {
      expect(link.getAttribute('rel')).toContain('noopener')
    })
  })
})
