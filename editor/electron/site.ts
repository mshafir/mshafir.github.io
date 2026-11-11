import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import type {
  GitStatus,
  MediaItem,
  PostDocument,
  PostSummary,
  ProjectsConfig,
  ProjectsState,
  Repo,
  SaveProjectsResult,
} from '../src/shared/api'
import { parsePostFile, serializePostFile } from './postFile'
import { readProjectsConfig, writeProjectsConfig } from './projectsConfig'

const run = promisify(execFile)
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const GITHUB_USER = 'mshafir'

/** Everything the editor does to the site's files, rooted at the repo. */
export class Site {
  readonly posts: string
  readonly publicDir: string
  readonly imagesDir: string
  readonly projectsConfig: string
  readonly projectsJson: string
  private repoCache: Repo[] | null = null
  private preview: ChildProcess | null = null

  constructor(
    readonly root: string,
    private readonly cacheFile: string,
    private readonly trash: (path: string) => Promise<void>,
  ) {
    this.posts = join(root, 'content/posts')
    this.publicDir = join(root, 'public')
    this.imagesDir = join(this.publicDir, 'images')
    this.projectsConfig = join(root, 'content/projects.config.yaml')
    this.projectsJson = join(root, 'src/data/projects.json')
  }

  // ── posts ────────────────────────────────────────────────────────────

  private postPath(slug: string): string {
    if (!SLUG.test(slug)) throw new Error(`"${slug}" is not a valid slug (lowercase letters, numbers, dashes).`)
    return join(this.posts, `${slug}.md`)
  }

  async listPosts(): Promise<PostSummary[]> {
    const files = (await readdir(this.posts)).filter((file) => file.endsWith('.md'))
    const posts = await Promise.all(
      files.map(async (file) => {
        const path = join(this.posts, file)
        try {
          const [raw, info] = await Promise.all([readFile(path, 'utf8'), stat(path)])
          return { slug: basename(file, '.md'), meta: parsePostFile(raw).meta, updatedAt: info.mtimeMs }
        } catch (error) {
          // Renamed or deleted between listing the folder and reading it.
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
          throw error
        }
      }),
    )
    return posts.filter((post) => post !== null).sort((a, b) => b.meta.date.localeCompare(a.meta.date) || b.updatedAt - a.updatedAt)
  }

  async readPost(slug: string): Promise<PostDocument> {
    const { meta, body } = parsePostFile(await readFile(this.postPath(slug), 'utf8'))
    return { slug, meta, body }
  }

  async savePost(post: PostDocument): Promise<void> {
    const path = this.postPath(post.slug)
    const extra = existsSync(path) ? parsePostFile(await readFile(path, 'utf8')).extra : {}
    await writeFile(path, serializePostFile({ meta: post.meta, extra, body: post.body }))
  }

  async createPost(): Promise<string> {
    let slug = 'untitled'
    for (let n = 2; existsSync(this.postPath(slug)); n++) slug = `untitled-${n}`
    const today = new Date().toISOString().slice(0, 10)
    await this.savePost({ slug, meta: { title: 'Untitled', date: today, description: '', tags: [], draft: true }, body: '' })
    return slug
  }

  async renamePost(from: string, to: string): Promise<void> {
    if (from === to) return
    const target = this.postPath(to)
    if (existsSync(target)) throw new Error(`A post called "${to}" already exists.`)
    await rename(this.postPath(from), target)
  }

  async deletePost(slug: string): Promise<void> {
    await this.trash(this.postPath(slug))
  }

  // ── images ───────────────────────────────────────────────────────────

  /** Copy an image into public/images/<folder>/ and return its site path. */
  async importImage(folder: string, fileName: string, bytes: ArrayBuffer): Promise<string> {
    const safeFolder = folder.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'uploads'
    const ext = extname(fileName).toLowerCase() || '.png'
    const stem =
      basename(fileName, extname(fileName))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'image'
    const dir = join(this.imagesDir, safeFolder)
    await mkdir(dir, { recursive: true })
    let name = `${stem}${ext}`
    for (let n = 2; existsSync(join(dir, name)); n++) name = `${stem}-${n}${ext}`
    await writeFile(join(dir, name), Buffer.from(bytes))
    return `/images/${safeFolder}/${name}`
  }

  /** Resolve a site path to a file inside public/, refusing anything that escapes it. */
  publicFile(sitePath: string): string {
    const file = resolve(this.publicDir, `.${decodeURIComponent(sitePath)}`)
    if (!file.startsWith(this.publicDir + sep)) throw new Error('Path is outside public/.')
    return file
  }

  async listMedia(): Promise<MediaItem[]> {
    if (!existsSync(this.imagesDir)) return []
    const entries = await readdir(this.imagesDir, { recursive: true, withFileTypes: true })
    const images = entries.filter((entry) => entry.isFile() && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(entry.name))
    const bodies = await Promise.all(
      (await this.listPosts()).map(async (post) => ({ slug: post.slug, text: (await this.readPost(post.slug)).body })),
    )
    const items = await Promise.all(
      images.map(async (entry) => {
        const file = join(entry.parentPath, entry.name)
        const path = `/${relative(this.publicDir, file).split(sep).join('/')}`
        return {
          path,
          bytes: (await stat(file)).size,
          usedBy: bodies.filter((post) => post.text.includes(path)).map((post) => post.slug),
        }
      }),
    )
    return items.sort((a, b) => a.path.localeCompare(b.path))
  }

  async deleteMedia(sitePath: string): Promise<void> {
    await this.trash(this.publicFile(sitePath))
  }

  // ── projects ─────────────────────────────────────────────────────────

  private async readConfig(): Promise<{ text: string; config: ProjectsConfig }> {
    const text = existsSync(this.projectsConfig) ? await readFile(this.projectsConfig, 'utf8') : ''
    return { text, config: readProjectsConfig(text) }
  }

  private async fetchRepos(): Promise<Repo[]> {
    const response = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'site-editor' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`)
    const raw = (await response.json()) as Array<Record<string, any>>
    const repos = raw
      .filter((repo) => !repo.fork)
      .map((repo) => ({
        name: repo.name,
        url: repo.html_url,
        description: repo.description ?? '',
        language: repo.language ?? null,
        stars: repo.stargazers_count ?? 0,
        pushedAt: repo.pushed_at,
      }))
    this.repoCache = repos
    await mkdir(dirname(this.cacheFile), { recursive: true })
    await writeFile(this.cacheFile, JSON.stringify(repos))
    return repos
  }

  /** Offline fallback: rebuild what we can from the committed projects.json and config. */
  private async committedRepos(config: ProjectsConfig): Promise<Repo[]> {
    const customNames = new Set(config.custom.map((project) => project.name))
    const committed = JSON.parse(await readFile(this.projectsJson, 'utf8')) as Array<Record<string, any>>
    const repos: Repo[] = committed
      .filter((project) => !project.custom && !customNames.has(project.name))
      .map((project) => ({
        name: project.name,
        url: project.url,
        // projects.json holds the override when there is one; GitHub's own text is unknown offline.
        description: config.blurbs[project.name] ? '' : project.blurb,
        language: project.language,
        stars: project.stars,
        pushedAt: project.pushedAt,
      }))
    for (const name of config.hidden) {
      if (!customNames.has(name) && !repos.some((repo) => repo.name === name)) {
        repos.push({ name, url: `https://github.com/${GITHUB_USER}/${name}`, description: '', language: null, stars: 0, pushedAt: '' })
      }
    }
    return repos
  }

  async loadProjects(): Promise<ProjectsState> {
    const { config } = await this.readConfig()
    if (!this.repoCache && existsSync(this.cacheFile)) {
      this.repoCache = JSON.parse(await readFile(this.cacheFile, 'utf8'))
    }
    if (!this.repoCache) {
      try {
        await this.fetchRepos()
      } catch {
        return { config, repos: await this.committedRepos(config), source: 'committed' }
      }
    }
    return { config, repos: this.repoCache!, source: 'github' }
  }

  async refreshProjects(): Promise<ProjectsState> {
    await this.fetchRepos()
    const { config } = await this.readConfig()
    await this.regenerate(config)
    return { config, repos: this.repoCache!, source: 'github' }
  }

  async saveProjects(config: ProjectsConfig): Promise<SaveProjectsResult> {
    const { text } = await this.readConfig()
    await writeFile(this.projectsConfig, writeProjectsConfig(text, config))
    return { regenerated: await this.regenerate(config) }
  }

  /** Rewrite src/data/projects.json with the site's own curate(), so the site reflects edits right away. */
  private async regenerate(config: ProjectsConfig): Promise<boolean> {
    if (!this.repoCache) return false
    const { curate } = await import(pathToFileURL(join(this.root, 'scripts/lib/curate.mjs')).href)
    const repos = this.repoCache.map((repo) => ({
      name: repo.name,
      html_url: repo.url,
      description: repo.description || null,
      language: repo.language,
      stargazers_count: repo.stars,
      pushed_at: repo.pushedAt,
      fork: false,
    }))
    const overrides = Object.fromEntries(Object.entries(config.blurbs).map(([name, blurb]) => [name, { blurb }]))
    const projects = curate(repos, { featured: config.featured, hidden: config.hidden, overrides, custom: config.custom })
    await writeFile(this.projectsJson, `${JSON.stringify(projects, null, 2)}\n`)
    return true
  }

  // ── repo & preview ───────────────────────────────────────────────────

  async gitStatus(): Promise<GitStatus> {
    try {
      const { stdout } = await run('git', ['status', '--porcelain=v1', '--branch'], { cwd: this.root })
      const lines = stdout.split('\n').filter(Boolean)
      const branch = lines[0]?.replace(/^## /, '').split('...')[0] ?? ''
      return { branch, changed: lines.length - 1 }
    } catch {
      return { branch: '', changed: 0 }
    }
  }

  /** Start the site's dev server once, and return the URL for a page on it. */
  async previewUrl(path = '/'): Promise<string> {
    const port = 5174
    if (!this.preview || this.preview.exitCode !== null) {
      this.preview = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
        cwd: this.root,
        stdio: 'ignore',
        detached: false,
      })
      await new Promise((done) => setTimeout(done, 2500))
    }
    return `http://localhost:${port}${path}`
  }

  stopPreview(): void {
    this.preview?.kill()
  }
}
