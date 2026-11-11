import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Site } from './site'
import type { Repo } from '../src/shared/api'

const realSite = resolve(__dirname, '../..')

// A throwaway copy of just the parts of the site the editor touches.
let root: string
let site: Site
let trashed: string[]

const repos: Repo[] = [
  { name: 'investbot', url: 'https://github.com/mshafir/investbot', description: 'gh text', language: 'Python', stars: 5, pushedAt: '2026-09-03T00:00:00Z' },
  { name: 'reactlit', url: 'https://github.com/mshafir/reactlit', description: 'React apps', language: 'TypeScript', stars: 12, pushedAt: '2025-04-25T00:00:00Z' },
  { name: 'vislib', url: 'https://github.com/mshafir/vislib', description: 'viz', language: 'Python', stars: 3, pushedAt: '2018-06-07T00:00:00Z' },
]

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'site-editor-'))
  for (const path of ['content', 'scripts/lib/curate.mjs', 'src/data/projects.json']) {
    cpSync(join(realSite, path), join(root, path), { recursive: true })
  }
  // Tests run against a known post rather than whatever is in content/posts.
  rmSync(join(root, 'content/posts'), { recursive: true })
  mkdirSync(join(root, 'content/posts'))
  cpSync(join(__dirname, 'fixtures/hello-world.md'), join(root, 'content/posts/hello-world.md'))
  trashed = []
  const cache = join(root, '.cache/github-repos.json')
  site = new Site(root, cache, async (path) => {
    trashed.push(path)
    await rm(path, { recursive: true })
  })
})

afterEach(() => rmSync(root, { recursive: true, force: true }))

const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('posts', () => {
  it('lists the existing post', async () => {
    const posts = await site.listPosts()
    expect(posts.map((p) => p.slug)).toEqual(['hello-world'])
    expect(posts[0].meta.title).toBe('Hello World')
  })

  it('creates a draft, edits it, renames it and deletes it', async () => {
    const slug = await site.createPost()
    expect(slug).toBe('untitled')
    expect(await site.createPost()).toBe('untitled-2')

    const post = await site.readPost(slug)
    expect(post.meta.draft).toBe(true)

    await site.savePost({ ...post, meta: { ...post.meta, title: 'My first real post', tags: ['agents'] }, body: '## Hi\n\nThere.\n' })
    await site.renamePost(slug, 'my-first-real-post')
    expect(existsSync(join(root, 'content/posts/untitled.md'))).toBe(false)
    expect(read('content/posts/my-first-real-post.md')).toContain('title: My first real post\n')
    expect(read('content/posts/my-first-real-post.md')).toContain('## Hi\n\nThere.\n')

    await site.deletePost('my-first-real-post')
    expect(trashed).toEqual([join(root, 'content/posts/my-first-real-post.md')])
  })

  it('refuses to rename over another post or to an unsafe slug', async () => {
    const slug = await site.createPost()
    await expect(site.renamePost(slug, 'hello-world')).rejects.toThrow(/already exists/)
    await expect(site.renamePost(slug, '../escape')).rejects.toThrow(/not a valid slug/)
  })
})

describe('images', () => {
  it('copies images into a folder per post, without overwriting', async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    expect(await site.importImage('my-post', 'Screen Shot 1.PNG', bytes)).toBe('/images/my-post/screen-shot-1.png')
    expect(await site.importImage('my-post', 'Screen Shot 1.PNG', bytes)).toBe('/images/my-post/screen-shot-1-2.png')
    expect(readFileSync(join(root, 'public/images/my-post/screen-shot-1.png'))).toEqual(Buffer.from([1, 2, 3]))
  })

  it('reports which posts use each image', async () => {
    const path = await site.importImage('hello-world', 'a.png', new Uint8Array([1]).buffer)
    await site.importImage('uploads', 'b.png', new Uint8Array([1]).buffer)
    const post = await site.readPost('hello-world')
    await site.savePost({ ...post, body: `${post.body}\n![A](${path})\n` })
    const media = await site.listMedia()
    expect(media.map((m) => [m.path, m.usedBy])).toEqual([
      ['/images/hello-world/a.png', ['hello-world']],
      ['/images/uploads/b.png', []],
    ])
  })

  it('never serves files outside public/', () => {
    expect(() => site.publicFile('/../content/posts/hello-world.md')).toThrow(/outside public/)
    expect(() => site.publicFile('/%2e%2e/secret')).toThrow(/outside public/)
  })
})

describe('projects', () => {
  it('saves the config and regenerates projects.json with the site’s own curate()', async () => {
    // Seed the GitHub cache so no network is needed.
    mkdirSync(join(root, '.cache'))
    writeFileSync(join(root, '.cache/github-repos.json'), JSON.stringify(repos))

    const state = await site.loadProjects()
    expect(state.source).toBe('github')

    const result = await site.saveProjects({
      ...state.config,
      featured: ['reactlit', 'investbot'],
      hidden: [...state.config.hidden, 'vislib'],
      blurbs: { ...state.config.blurbs, reactlit: 'Streamlit for React.' },
      custom: [{ name: 'a-talk', url: 'https://example.com', blurb: 'Slides', date: '2026-10-01' }],
    })
    expect(result.regenerated).toBe(true)

    const projects = JSON.parse(read('src/data/projects.json'))
    expect(projects.map((p: { name: string }) => p.name)).toEqual(['reactlit', 'investbot', 'a-talk'])
    expect(projects[0].blurb).toBe('Streamlit for React.')
    expect(projects[2].custom).toBe(true)
    expect(read('content/projects.config.yaml')).toContain('# Pinned to the top of the list, in this order.')
  })
})
