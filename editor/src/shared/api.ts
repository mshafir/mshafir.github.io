/** The contract between the window and the Electron main process (exposed as `window.site`). */

export interface PostMeta {
  title: string
  date: string
  description: string
  tags: string[]
  draft: boolean
}

export interface PostSummary {
  slug: string
  meta: PostMeta
  /** ms since epoch, from the file */
  updatedAt: number
}

export interface PostDocument {
  slug: string
  meta: PostMeta
  body: string
}

export interface CustomProject {
  name: string
  url: string
  blurb: string
  language?: string
  date?: string
}

export interface ProjectsConfig {
  featured: string[]
  hidden: string[]
  blurbs: Record<string, string>
  custom: CustomProject[]
}

/** A GitHub repo the site can show, with what GitHub says about it. */
export interface Repo {
  name: string
  url: string
  description: string
  language: string | null
  stars: number
  pushedAt: string
}

export interface ProjectsState {
  config: ProjectsConfig
  repos: Repo[]
  /** Where `repos` came from: a live GitHub fetch, or the committed projects.json when offline. */
  source: 'github' | 'committed'
}

export interface SaveProjectsResult {
  /** False when the site's projects.json could not be regenerated (no repo data yet). */
  regenerated: boolean
}

export interface MediaItem {
  /** Site path, e.g. /images/my-post/photo.png */
  path: string
  bytes: number
  usedBy: string[]
}

export interface GitStatus {
  branch: string
  changed: number
}

export interface SiteApi {
  root: string
  listPosts(): Promise<PostSummary[]>
  readPost(slug: string): Promise<PostDocument>
  savePost(post: PostDocument): Promise<void>
  createPost(): Promise<string>
  renamePost(from: string, to: string): Promise<void>
  deletePost(slug: string): Promise<void>

  importImage(folder: string, fileName: string, bytes: ArrayBuffer): Promise<string>
  listMedia(): Promise<MediaItem[]>
  deleteMedia(path: string): Promise<void>

  loadProjects(): Promise<ProjectsState>
  saveProjects(config: ProjectsConfig): Promise<SaveProjectsResult>
  refreshProjects(): Promise<ProjectsState>

  gitStatus(): Promise<GitStatus>
  previewSite(path?: string): Promise<void>
  openExternal(url: string): Promise<void>
}

declare global {
  interface Window {
    site: SiteApi
  }
}
