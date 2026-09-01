import { describe, it, expect } from 'vitest'
import { parsePost } from './parse'

const passthrough = (code: string, lang: string) =>
  `<pre data-lang="${lang}"><code>${code}</code></pre>`

const sample = [
  '---',
  'title: On Agent Architecture',
  'date: 2026-08-14',
  'description: Why the interesting part is the boundary.',
  'tags: [ai, architecture]',
  '---',
  '',
  'Some opening prose.',
  '',
  '## First section',
  '',
  'More prose with `inline code`.',
  '',
  '### A nested heading',
  '',
  '```ts',
  'const x: number = 1',
  '```',
  '',
  '## Second section',
  '',
  'Closing prose.',
  '',
].join('\n')

describe('parsePost', () => {
  it('parses frontmatter fields', () => {
    const post = parsePost(sample, 'on-agent-architecture', passthrough)
    expect(post.frontmatter.title).toBe('On Agent Architecture')
    expect(post.frontmatter.date).toBe('2026-08-14')
    expect(post.frontmatter.description).toBe('Why the interesting part is the boundary.')
    expect(post.frontmatter.tags).toEqual(['ai', 'architecture'])
  })

  it('defaults draft to false, tags to empty, description to empty', () => {
    const minimal = '---\ntitle: T\ndate: 2026-01-01\n---\n\nBody.\n'
    const post = parsePost(minimal, 't', passthrough)
    expect(post.frontmatter.draft).toBe(false)
    expect(post.frontmatter.tags).toEqual([])
    expect(post.frontmatter.description).toBe('')
  })

  it('keeps the slug it was given', () => {
    expect(parsePost(sample, 'my-slug', passthrough).slug).toBe('my-slug')
  })

  it('renders markdown to html', () => {
    const post = parsePost(sample, 's', passthrough)
    expect(post.html).toContain('<p>Some opening prose.</p>')
    expect(post.html).toContain('<code>inline code</code>')
  })

  it('extracts a table of contents with slugified ids', () => {
    expect(parsePost(sample, 's', passthrough).toc).toEqual([
      { depth: 2, text: 'First section', id: 'first-section' },
      { depth: 3, text: 'A nested heading', id: 'a-nested-heading' },
      { depth: 2, text: 'Second section', id: 'second-section' },
    ])
  })

  it('gives headings anchor ids matching the toc', () => {
    expect(parsePost(sample, 's', passthrough).html).toContain('id="first-section"')
  })

  it('disambiguates repeated heading text', () => {
    const dupes = '---\ntitle: T\ndate: 2026-01-01\n---\n\n## Notes\n\n## Notes\n'
    expect(parsePost(dupes, 'd', passthrough).toc.map((h) => h.id)).toEqual(['notes', 'notes-1'])
  })

  it('routes fenced code through the highlighter with its language', () => {
    expect(parsePost(sample, 's', passthrough).html).toContain('data-lang="ts"')
  })

  it('estimates reading time at a minimum of one minute', () => {
    expect(parsePost(sample, 's', passthrough).readingTime).toBeGreaterThanOrEqual(1)
  })

  it('scales reading time with length', () => {
    const long = `---\ntitle: T\ndate: 2026-01-01\n---\n\n${'word '.repeat(2000)}`
    expect(parsePost(long, 'l', passthrough).readingTime).toBeGreaterThan(5)
  })

  it('throws naming the slug and the field when title is missing', () => {
    const bad = '---\ndate: 2026-01-01\n---\n\nBody.\n'
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/broken/)
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/title/)
  })

  it('throws when date is missing', () => {
    const bad = '---\ntitle: T\n---\n\nBody.\n'
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/date/)
  })

  it('normalizes a Date-typed frontmatter date to an ISO day string', () => {
    const withDate = '---\ntitle: T\ndate: 2026-03-04\n---\n\nBody.\n'
    expect(parsePost(withDate, 'd', passthrough).frontmatter.date).toBe('2026-03-04')
  })
})
