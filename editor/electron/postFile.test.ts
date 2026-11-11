import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parsePostFile, serializePostFile } from './postFile'

const helloWorld = readFileSync(resolve(__dirname, 'fixtures/hello-world.md'), 'utf8')

describe('post files', () => {
  it('reads the frontmatter the site uses', () => {
    const post = parsePostFile(helloWorld)
    expect(post.meta).toEqual({
      title: 'Hello World',
      date: '2026-09-01',
      description: 'A placeholder first post — the shape of the thing before the thing.',
      tags: ['meta'],
      draft: false,
    })
    expect(post.body.startsWith('This is the starter post.')).toBe(true)
  })

  it('writes an unchanged post back byte for byte', () => {
    expect(serializePostFile(parsePostFile(helloWorld))).toBe(helloWorld)
  })

  it('writes draft only when true and quotes titles that need it', () => {
    const out = serializePostFile({
      meta: { title: 'Building investbot: a story', date: '2026-11-11', description: '', tags: [], draft: true },
      extra: {},
      body: 'Hi',
    })
    expect(out).toBe(
      `---\ntitle: "Building investbot: a story"\ndate: 2026-11-11\ndescription: ""\ntags: []\ndraft: true\n---\n\nHi\n`,
    )
    expect(parsePostFile(out).meta.title).toBe('Building investbot: a story')
  })

  it('keeps frontmatter keys it does not manage', () => {
    const raw = '---\ntitle: T\ndate: 2026-01-01\ndescription: d\ntags: []\ncanonical: https://x.dev\n---\n\nBody\n'
    expect(serializePostFile(parsePostFile(raw))).toContain('canonical: https://x.dev')
  })
})
