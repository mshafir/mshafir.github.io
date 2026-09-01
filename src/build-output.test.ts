import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPosts } from './content/posts'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const read = (path: string) => readFileSync(resolve(dist, path), 'utf8')

// Asserts on real build output, so it only runs once `dist/` exists.
const describeBuild = existsSync(dist) ? describe : describe.skip

describeBuild('static build output', () => {
  it('prerenders every top-level route', () => {
    for (const path of [
      'index.html',
      'projects/index.html',
      'writing/index.html',
      'about/index.html',
    ]) {
      expect(existsSync(resolve(dist, path)), path).toBe(true)
    }
  })

  it('prerenders a page per post', () => {
    for (const post of allPosts) {
      expect(existsSync(resolve(dist, `writing/${post.slug}/index.html`)), post.slug).toBe(true)
    }
  })

  it('puts each post title into its own static html', () => {
    for (const post of allPosts) {
      expect(read(`writing/${post.slug}/index.html`)).toContain(post.frontmatter.title)
    }
  })

  it('gives each page exactly one title tag', () => {
    for (const path of ['index.html', 'projects/index.html', 'about/index.html']) {
      expect(read(path).match(/<title[^>]*>/g) ?? [], path).toHaveLength(1)
    }
  })

  it('puts post prose into the static html, not only the bundle', () => {
    const html = read(`writing/${allPosts[0].slug}/index.html`)
    expect(html).toContain('class="prose"')
    expect(html.length).toBeGreaterThan(2000)
  })

  it('prerenders each page with its own content rather than the home page', () => {
    // Guards the failure mode where every route serves the home shell.
    expect(read('index.html')).toContain('class="hero"')
    expect(read('projects/index.html')).not.toContain('class="hero"')
    expect(read('about/index.html')).not.toContain('class="hero"')
  })

  it('gives each route its own canonical url', () => {
    expect(read('projects/index.html')).toContain('https://mshafir.github.io/projects')
    expect(read('about/index.html')).toContain('https://mshafir.github.io/about')
  })

  it('ships a nojekyll marker so underscore paths survive github pages', () => {
    expect(existsSync(resolve(dist, '.nojekyll'))).toBe(true)
  })
})
