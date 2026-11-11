import { useCallback, useEffect, useState } from 'react'
import type { GitStatus } from './shared/api'
import { BranchIcon, ImageIcon, PostsIcon, ProjectsIcon } from './icons'
import { PostsList } from './views/PostsList'
import { PostEditor } from './views/PostEditor'
import { Projects } from './views/Projects'
import { Media } from './views/Media'

export type Route = { view: 'posts' } | { view: 'post'; slug: string } | { view: 'projects' } | { view: 'media' }

function parseHash(hash: string): Route {
  const [view, slug] = hash.replace(/^#\/?/, '').split('/')
  if (view === 'post' && slug) return { view: 'post', slug: decodeURIComponent(slug) }
  if (view === 'projects' || view === 'media') return { view }
  return { view: 'posts' }
}

export function routeHash(route: Route): string {
  return route.view === 'post' ? `#post/${encodeURIComponent(route.slug)}` : `#${route.view}`
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash))
  const [git, setGit] = useState<GitStatus | null>(null)
  const [counts, setCounts] = useState({ posts: 0, media: 0 })

  useEffect(() => {
    const onHash = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = useCallback((next: Route) => {
    location.hash = routeHash(next)
  }, [])

  const refreshStatus = useCallback(async () => {
    const [status, posts, media] = await Promise.all([
      window.site.gitStatus(),
      window.site.listPosts(),
      window.site.listMedia(),
    ])
    setGit(status)
    setCounts({ posts: posts.length, media: media.length })
  }, [])

  useEffect(() => {
    void refreshStatus()
    const timer = setInterval(refreshStatus, 4000)
    return () => clearInterval(timer)
  }, [refreshStatus])

  const section = route.view === 'post' ? 'posts' : route.view

  return (
    <div className="app">
      {route.view !== 'post' && (
        <nav className="sidebar" aria-label="Sections">
          <div className="brand">
            mshafir<span>.site</span>
          </div>
          <a className="nav-item" aria-current={section === 'posts' ? 'page' : undefined} href="#posts">
            <PostsIcon />
            <span>Posts</span>
            <span className="count">{counts.posts}</span>
          </a>
          <a className="nav-item" aria-current={section === 'projects' ? 'page' : undefined} href="#projects">
            <ProjectsIcon />
            <span>Projects</span>
          </a>
          <a className="nav-item" aria-current={section === 'media' ? 'page' : undefined} href="#media">
            <ImageIcon />
            <span>Media</span>
            <span className="count">{counts.media}</span>
          </a>
          <div className="spacer" />
          <div className="repo-card">
            <div className="repo-line">
              <BranchIcon />
              {git ? `${git.branch || 'detached'} · ${git.changed} changed ${git.changed === 1 ? 'file' : 'files'}` : '…'}
            </div>
            <p>Saved to disk as you type. Commit &amp; push from your terminal when ready.</p>
            <button type="button" className="btn btn-ghost" onClick={() => window.site.previewSite('/')}>
              Preview site locally
            </button>
          </div>
        </nav>
      )}
      <main className="content">
        {route.view === 'posts' && <PostsList onOpen={(slug) => navigate({ view: 'post', slug })} />}
        {route.view === 'post' && (
          <PostEditor
            key={route.slug}
            slug={route.slug}
            onBack={() => navigate({ view: 'posts' })}
            onRenamed={(slug) => history.replaceState(null, '', routeHash({ view: 'post', slug }))}
            onSaved={refreshStatus}
          />
        )}
        {route.view === 'projects' && <Projects onSaved={refreshStatus} />}
        {route.view === 'media' && <Media onChanged={refreshStatus} />}
      </main>
    </div>
  )
}
