import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readProjectsConfig, writeProjectsConfig } from './projectsConfig'

// A snapshot of the site's config, so editing the real one doesn't break these tests.
const real = readFileSync(resolve(__dirname, 'fixtures/projects.config.yaml'), 'utf8')

describe('projects config', () => {
  it('reads featured, hidden and blurbs from the site config', () => {
    const config = readProjectsConfig(real)
    expect(config.featured).toEqual(['investbot', 'auto-adventure', 'reactlit'])
    expect(config.hidden).toContain('weddingsite')
    expect(config.blurbs.investbot).toMatch(/^I gave claude access/)
    expect(config.custom).toEqual([])
  })

  it('writes back what it read without losing anything', () => {
    const config = readProjectsConfig(real)
    expect(readProjectsConfig(writeProjectsConfig(real, config))).toEqual(config)
  })

  it('keeps the explanatory comments', () => {
    const out = writeProjectsConfig(real, readProjectsConfig(real))
    expect(out).toContain('# Pinned to the top of the list, in this order.')
    expect(out).toContain('# Never shown, even if GitHub returns them.')
  })

  it('applies reorders, hides, blurb edits, removals and custom projects', () => {
    const config = readProjectsConfig(real)
    const next = {
      featured: ['reactlit', 'investbot'],
      hidden: [...config.hidden, 'auto-adventure'],
      blurbs: { investbot: 'Short now.', vislib: 'New blurb' },
      custom: [{ name: 'talk', url: 'https://example.com', blurb: 'Slides', date: '2026-10-01' }],
    }
    expect(readProjectsConfig(writeProjectsConfig(real, next))).toEqual(next)
  })

  it('starts from an empty file', () => {
    const next = { featured: ['a'], hidden: [], blurbs: { a: 'b' }, custom: [] }
    expect(readProjectsConfig(writeProjectsConfig('', next))).toEqual(next)
  })
  it('leaves the file byte-for-byte alone when nothing changed', () => {
    expect(writeProjectsConfig(real, readProjectsConfig(real))).toBe(real)
  })

  it('keeps the hand-wrapped formatting of blurbs it did not change', () => {
    const config = readProjectsConfig(real)
    const out = writeProjectsConfig(real, { ...config, featured: ['auto-adventure', 'investbot', 'reactlit'], blurbs: { ...config.blurbs, reactlit: 'Shorter.' } })
    const untouched = real.slice(real.indexOf('  investbot:\n    blurb:'), real.indexOf('  reactlit:'))
    expect(out).toContain(untouched)
    expect(out).toContain('  reactlit:\n    blurb: Shorter.\n')
    expect(out).toContain('featured:\n  - auto-adventure\n  - investbot\n  - reactlit\n')
  })

  it('removes an override and adds new ones without disturbing the rest', () => {
    const config = readProjectsConfig(real)
    const { reactlit: _, ...rest } = config.blurbs
    const out = writeProjectsConfig(real, { ...config, blurbs: { ...rest, vislib: 'Charts.' } })
    expect(out).not.toContain('reactlit:\n    blurb')
    expect(readProjectsConfig(out).blurbs).toEqual({ ...rest, vislib: 'Charts.' })
    expect(out).toContain('# Per-repo fields that replace what GitHub reports.')
  })
})
