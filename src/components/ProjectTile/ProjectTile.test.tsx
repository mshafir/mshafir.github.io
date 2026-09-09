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

describe('ProjectGrid layout', () => {
  it('renders featured projects as feature rows ahead of the compact grid', () => {
    const { container } = setup()
    const rows = container.querySelector('.tile-rows')!
    const grid = container.querySelector('.tile-grid')!
    expect(rows.querySelector('.tile--feature')?.textContent).toContain('reactlit')
    expect(grid.textContent).toContain('vislib')
    expect(grid.querySelector('.tile--feature')).toBeNull()
    expect(rows.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('omits the compact grid when everything is featured', () => {
    const { container } = render(
      <MemoryRouter>
        <KeyboardProvider>
          <ProjectGrid id="featured-only" projects={[projects[0]]} />
        </KeyboardProvider>
      </MemoryRouter>,
    )
    expect(container.querySelector('.tile-rows')).not.toBeNull()
    expect(container.querySelector('.tile-grid')).toBeNull()
  })

  it('keeps every project reachable from one keyboard scope', () => {
    const { container } = setup()
    const scopes = container.querySelectorAll('[data-roving-list]')
    expect(scopes).toHaveLength(1)
    expect(scopes[0].querySelectorAll('a')).toHaveLength(2)
  })
})
