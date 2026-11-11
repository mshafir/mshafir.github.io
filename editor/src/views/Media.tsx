import { useEffect, useRef, useState } from 'react'
import type { MediaItem } from '../shared/api'
import { TrashIcon, UploadIcon } from '../icons'
import { ASSET_ORIGIN } from '../lib/markdown'
import { formatBytes } from '../lib/format'

export function Media({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [armed, setArmed] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = () => window.site.listMedia().then(setItems)
  useEffect(() => void load(), [])

  async function upload(files: File[]) {
    for (const file of files) await window.site.importImage('uploads', file.name, await file.arrayBuffer())
    setMessage(`Added ${files.length} ${files.length === 1 ? 'image' : 'images'} to public/images/uploads/.`)
    await load()
    onChanged()
  }

  async function remove(path: string) {
    if (armed !== path) return setArmed(path)
    await window.site.deleteMedia(path)
    setArmed(null)
    setMessage(`Moved ${path} to the Trash.`)
    await load()
    onChanged()
  }

  async function copy(item: MediaItem) {
    await navigator.clipboard.writeText(`![](${item.path})`)
    setMessage(`Copied markdown for ${item.path}`)
  }

  return (
    <div
      className="page"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
        if (files.length) void upload(files)
      }}
    >
      <header className="page-head">
        <h1>Media</h1>
        <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
          <UploadIcon /> Add images
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) void upload(files)
          }}
        />
      </header>
      <p className="hint">
        Everything in <span className="mono">public/images/</span>. Images you drop into a post land in a folder named after it. Drop files anywhere here to add them.
      </p>
      {message && (
        <p className="hint status-line" role="status">
          {message}
        </p>
      )}

      {items && items.length === 0 && <p className="empty">No images yet. Drop some here, or add them while writing a post.</p>}
      <div className="media-grid">
        {items?.map((item) => (
          <figure key={item.path} className="media-card">
            <img src={`${ASSET_ORIGIN}${item.path}`} alt="" loading="lazy" />
            <figcaption>
              <span className="mono small" title={item.path}>
                {item.path.replace('/images/', '')}
              </span>
              <span className="dim small">
                {formatBytes(item.bytes)} · {item.usedBy.length ? `in ${item.usedBy.join(', ')}` : 'not used'}
              </span>
              <span className="media-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(item)}>
                  Copy markdown
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={item.usedBy.length > 0}
                  title={item.usedBy.length ? 'Remove it from its posts first' : undefined}
                  onClick={() => remove(item.path)}
                >
                  <TrashIcon /> {armed === item.path ? 'Confirm' : 'Delete'}
                </button>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
