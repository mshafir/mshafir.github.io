import { describe, it, expect } from 'vitest'
import { curate } from './curate.mjs'

const repos = [
  { name: 'reactlit', html_url: 'u/reactlit', description: 'gh blurb', language: 'TypeScript', stargazers_count: 12, pushed_at: '2025-04-25T00:00:00Z', fork: false },
  { name: 'auto-adventure', html_url: 'u/auto', description: 'ai game', language: 'TypeScript', stargazers_count: 1, pushed_at: '2026-08-17T00:00:00Z', fork: false },
  { name: 'weddingsite', html_url: 'u/wed', description: 'personal', language: 'HTML', stargazers_count: 0, pushed_at: '2019-03-29T00:00:00Z', fork: false },
  { name: 'vislib', html_url: 'u/vislib', description: 'viz', language: 'Python', stargazers_count: 3, pushed_at: '2018-06-07T00:00:00Z', fork: false },
  { name: 'somebodys-repo', html_url: 'u/fork', description: 'a fork', language: 'Go', stargazers_count: 99, pushed_at: '2026-01-01T00:00:00Z', fork: true },
]

const config = {
  featured: ['auto-adventure', 'reactlit'],
  hidden: ['weddingsite'],
  overrides: { reactlit: { blurb: 'A faster way to build React apps.' } },
}

describe('curate', () => {
  it('drops forks', () => {
    expect(curate(repos, config).map((p) => p.name)).not.toContain('somebodys-repo')
  })

  it('drops hidden repos', () => {
    expect(curate(repos, config).map((p) => p.name)).not.toContain('weddingsite')
  })

  it('orders featured repos first, in configured order', () => {
    expect(curate(repos, config).map((p) => p.name).slice(0, 2)).toEqual([
      'auto-adventure',
      'reactlit',
    ])
  })

  it('sorts non-featured repos by most recent push', () => {
    const extra = [
      ...repos,
      { name: 'multilaunch', html_url: 'u/ml', description: 'cli', language: 'TypeScript', stargazers_count: 1, pushed_at: '2021-11-11T00:00:00Z', fork: false },
    ]
    const tail = curate(extra, config).filter((p) => !p.featured).map((p) => p.name)
    expect(tail).toEqual(['multilaunch', 'vislib'])
  })

  it('marks featured projects', () => {
    const byName = Object.fromEntries(curate(repos, config).map((p) => [p.name, p]))
    expect(byName['auto-adventure'].featured).toBe(true)
    expect(byName['vislib'].featured).toBe(false)
  })

  it('prefers an override blurb over the GitHub description', () => {
    const byName = Object.fromEntries(curate(repos, config).map((p) => [p.name, p]))
    expect(byName['reactlit'].blurb).toBe('A faster way to build React apps.')
    expect(byName['vislib'].blurb).toBe('viz')
  })

  it('falls back to an empty blurb when GitHub has no description', () => {
    const bare = [
      { name: 'bare', html_url: 'u/bare', description: null, language: null, stargazers_count: 0, pushed_at: '2020-01-01T00:00:00Z', fork: false },
    ]
    expect(curate(bare, { featured: [], hidden: [], overrides: {} })[0].blurb).toBe('')
  })

  it('tolerates a config missing optional keys', () => {
    expect(() => curate(repos, {})).not.toThrow()
    expect(curate(repos, {}).length).toBe(4)
  })
})
