import { useEffect, useMemo, useRef, useState } from 'react'
import type { PostSummary } from '../shared/api'
import { PlusIcon, SearchIcon } from '../icons'
import { formatDay, relativeTime } from '../lib/format'

type Filter = 'all' | 'draft' | 'published'

export function PostsList({ onOpen }: { onOpen: (slug: string) => void }) {
  const [posts, setPosts] = useState<PostSummary[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void window.site.listPosts().then(setPosts)
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const counts = useMemo(() => {
    const all = posts ?? []
    return { all: all.length, draft: all.filter((p) => p.meta.draft).length, published: all.filter((p) => !p.meta.draft).length }
  }, [posts])

  const visible = (posts ?? []).filter((post) => {
    if (filter === 'draft' && !post.meta.draft) return false
    if (filter === 'published' && post.meta.draft) return false
    const q = query.trim().toLowerCase()
    return !q || `${post.meta.title} ${post.meta.description} ${post.meta.tags.join(' ')}`.toLowerCase().includes(q)
  })

  async function newPost() {
    onOpen(await window.site.createPost())
  }

  const tabs: Array<[Filter, string]> = [
    ['all', 'All'],
    ['draft', 'Drafts'],
    ['published', 'Published'],
  ]

  return (
    <div className="page">
      <header className="page-head">
        <h1>Posts</h1>
        <label className="search">
          <SearchIcon />
          <input ref={search} type="search" placeholder="Search posts" aria-label="Search posts" value={query} onChange={(e) => setQuery(e.target.value)} />
          <kbd>Ctrl K</kbd>
        </label>
        <button type="button" className="btn btn-primary" onClick={newPost}>
          <PlusIcon /> New post
        </button>
      </header>

      <div className="tabs" role="tablist" aria-label="Filter posts">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label} <span className="count">{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="post-table">
        <div className="post-row post-row-head" aria-hidden="true">
          <span>Title</span>
          <span>Status</span>
          <span>Date</span>
          <span>Updated</span>
        </div>
        {posts && visible.length === 0 && (
          <p className="empty">{query ? 'No posts match that search.' : 'Nothing here yet.'}</p>
        )}
        {visible.map((post) => (
          <button key={post.slug} type="button" className="post-row" onClick={() => onOpen(post.slug)}>
            <span className="post-title">
              <strong>{post.meta.title || 'Untitled'}</strong>
              <span>{post.meta.description || `${post.slug}.md`}</span>
            </span>
            <span className={`badge ${post.meta.draft ? 'badge-draft' : 'badge-published'}`}>
              {post.meta.draft ? 'Draft' : 'Published'}
            </span>
            <span className="mono">{formatDay(post.meta.date)}</span>
            <span className="dim">{relativeTime(post.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
