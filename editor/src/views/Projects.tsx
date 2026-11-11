import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { CustomProject, ProjectsConfig, ProjectsState } from '../shared/api'
import { ExternalIcon, GripIcon, PlusIcon, RefreshIcon, TrashIcon } from '../icons'
import { formatDay } from '../lib/format'

type Placement = 'featured' | 'shown' | 'hidden'

interface Item {
  name: string
  url: string
  description: string
  language: string | null
  stars: number
  pushedAt: string
  custom: boolean
}

const SAVE_DELAY = 500

export function Projects({ onSaved }: { onSaved: () => void }) {
  const [state, setState] = useState<ProjectsState | null>(null)
  const [config, setConfig] = useState<ProjectsConfig | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const latest = useRef<ProjectsConfig | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.site.loadProjects().then(
      (loaded) => {
        setState(loaded)
        setConfig(loaded.config)
        latest.current = loaded.config
        setSelected(loaded.config.featured[0] ?? loaded.repos[0]?.name ?? null)
        if (loaded.source === 'committed') setMessage('Offline: showing the committed project list. GitHub details may be out of date.')
      },
      (e: Error) => setMessage(`Could not load projects: ${e.message}`),
    )
  }, [])

  const save = useCallback(async () => {
    timer.current = null
    if (!latest.current) return
    try {
      const result = await window.site.saveProjects(latest.current)
      setMessage(
        result.regenerated
          ? 'Saved to projects.config.yaml and projects.json.'
          : 'Saved to projects.config.yaml. Refresh from GitHub to update projects.json.',
      )
      onSaved()
    } catch (e) {
      setMessage(`Not saved: ${(e as Error).message}`)
    }
  }, [onSaved])

  // Save anything pending when leaving the screen.
  useEffect(() => () => void (timer.current && latest.current && window.site.saveProjects(latest.current)), [])

  const update = (fn: (c: ProjectsConfig) => ProjectsConfig) => {
    if (!latest.current) return
    const next = fn(latest.current)
    latest.current = next
    setConfig(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(save, SAVE_DELAY)
  }

  const items = useMemo<Item[]>(() => {
    if (!state || !config) return []
    const repos = state.repos.map((repo) => ({ ...repo, custom: false }))
    const custom = config.custom.map((project) => ({
      name: project.name,
      url: project.url,
      description: '',
      language: project.language ?? null,
      stars: 0,
      pushedAt: project.date ?? '',
      custom: true,
    }))
    return [...repos, ...custom]
  }, [state, config])

  if (!config || !state) return <div className="page dim">{message ?? 'Loading projects…'}</div>

  const byName = new Map(items.map((item) => [item.name, item]))
  const featured = config.featured.filter((name) => byName.has(name))
  const hidden = config.hidden
  const shown = items
    .filter((item) => !config.featured.includes(item.name) && !hidden.includes(item.name))
    .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))

  const placementOf = (name: string): Placement =>
    config.featured.includes(name) ? 'featured' : config.hidden.includes(name) ? 'hidden' : 'shown'

  function place(name: string, placement: Placement, index?: number) {
    update((c) => {
      const featured = c.featured.filter((n) => n !== name)
      const hidden = c.hidden.filter((n) => n !== name)
      if (placement === 'featured') featured.splice(index ?? featured.length, 0, name)
      if (placement === 'hidden') hidden.push(name)
      return { ...c, featured, hidden }
    })
  }

  function move(name: string, delta: number) {
    const index = config!.featured.indexOf(name)
    const target = index + delta
    if (index < 0 || target < 0 || target >= config!.featured.length) return
    place(name, 'featured', target)
  }

  function addProject() {
    let name = 'new-project'
    for (let n = 2; byName.has(name); n++) name = `new-project-${n}`
    update((c) => ({ ...c, custom: [...c.custom, { name, url: '', blurb: '', date: new Date().toISOString().slice(0, 10) }] }))
    setSelected(name)
  }

  async function refresh() {
    setBusy(true)
    try {
      if (timer.current) await save()
      const loaded = await window.site.refreshProjects()
      setState(loaded)
      setConfig(loaded.config)
      latest.current = loaded.config
      setMessage('Refreshed from GitHub and regenerated projects.json.')
      onSaved()
    } catch (e) {
      setMessage(`Could not reach GitHub: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const drag = {
    start: (name: string) => (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', name)
      e.dataTransfer.effectAllowed = 'move'
    },
    over: (e: DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
    },
    drop: (placement: Placement, index?: number) => (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const name = e.dataTransfer.getData('text/plain')
      if (name) place(name, placement, index)
    },
  }

  const current = selected ? byName.get(selected) : undefined

  return (
    <div className="projects">
      <section className="project-list" aria-label="Project order">
        <header className="page-head">
          <h1>Projects</h1>
          <button type="button" className="btn btn-ghost btn-icon" aria-label="Refresh from GitHub" title="Refresh from GitHub" disabled={busy} onClick={refresh}>
            <RefreshIcon />
          </button>
          <button type="button" className="btn btn-primary" onClick={addProject}>
            <PlusIcon /> Add project
          </button>
        </header>
        <p className="hint">Drag between groups. Featured projects lead the grid on the site, in this order; the rest follow by most recent activity.</p>
        {message && (
          <p className="hint status-line" role="status">
            {message}
          </p>
        )}

        <div className="group" onDragOver={drag.over} onDrop={drag.drop('featured')}>
          <span className="label-caps accent">Featured · {featured.length}</span>
          {featured.map((name, index) => {
            const item = byName.get(name)!
            return (
              <div
                key={name}
                className={`project-row featured ${selected === name ? 'selected' : ''}`}
                draggable
                onDragStart={drag.start(name)}
                onDragOver={drag.over}
                onDrop={drag.drop('featured', index)}
              >
                <span className="grip">
                  <GripIcon />
                </span>
                <button type="button" className="row-main" onClick={() => setSelected(name)}>
                  <strong>{name}</strong>
                  <span className="mono dim small">{meta(item)}</span>
                </button>
                <span className="row-actions">
                  <button type="button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => move(name, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label={`Move ${name} down`} disabled={index === featured.length - 1} onClick={() => move(name, 1)}>
                    ↓
                  </button>
                </span>
              </div>
            )
          })}
          {!featured.length && <p className="drop-hint">Drag a project here to feature it.</p>}
        </div>

        <div className="group" onDragOver={drag.over} onDrop={drag.drop('shown')}>
          <span className="label-caps">Shown · {shown.length}</span>
          {shown.map((item) => (
            <div key={item.name} className={`project-row ${selected === item.name ? 'selected' : ''} ${item.custom ? 'custom' : ''}`} draggable onDragStart={drag.start(item.name)}>
              <span className="grip">
                <GripIcon />
              </span>
              <button type="button" className="row-main" onClick={() => setSelected(item.name)}>
                <span>{item.name}</span>
                {item.custom ? <span className="pill">custom</span> : <span className="mono dim small">{item.language ?? ''}</span>}
              </button>
            </div>
          ))}
        </div>

        <div className="group" onDragOver={drag.over} onDrop={drag.drop('hidden')}>
          <span className="label-caps">Hidden · {hidden.length}</span>
          <div className="chips">
            {hidden.map((name) => (
              <button
                key={name}
                type="button"
                className={`chip hidden-chip ${selected === name ? 'selected' : ''}`}
                draggable
                onDragStart={drag.start(name)}
                onClick={() => setSelected(name)}
              >
                {name}
              </button>
            ))}
            {!hidden.length && <p className="drop-hint">Drag a project here to hide it.</p>}
          </div>
        </div>
      </section>

      <section className="project-detail" aria-label="Edit project">
        {current ? (
          <ProjectDetail
            key={current.name}
            item={current}
            placement={placementOf(current.name)}
            blurb={config.blurbs[current.name] ?? ''}
            custom={config.custom.find((p) => p.name === current.name)}
            taken={(name) => byName.has(name)}
            onPlace={(p) => place(current.name, p)}
            onBlurb={(text) =>
              update((c) => {
                const blurbs = { ...c.blurbs }
                if (text.trim()) blurbs[current.name] = text
                else delete blurbs[current.name]
                return { ...c, blurbs }
              })
            }
            onCustom={(patch) =>
              update((c) => {
                const rename = (n: string) => (patch.name && n === current.name ? patch.name : n)
                if (patch.name) setSelected(patch.name)
                return {
                  ...c,
                  featured: c.featured.map(rename),
                  hidden: c.hidden.map(rename),
                  custom: c.custom.map((p) => (p.name === current.name ? { ...p, ...patch } : p)),
                }
              })
            }
            onDelete={() => {
              update((c) => ({
                ...c,
                featured: c.featured.filter((n) => n !== current.name),
                hidden: c.hidden.filter((n) => n !== current.name),
                custom: c.custom.filter((p) => p.name !== current.name),
              }))
              setSelected(null)
            }}
          />
        ) : (
          <p className="dim">Select a project to edit it.</p>
        )}
      </section>
    </div>
  )
}

function meta(item: Item): string {
  if (item.custom) return 'custom'
  return [item.language, `★${item.stars}`].filter(Boolean).join(' · ')
}

function ProjectDetail({
  item,
  placement,
  blurb,
  custom,
  taken,
  onPlace,
  onBlurb,
  onCustom,
  onDelete,
}: {
  item: Item
  placement: Placement
  blurb: string
  custom?: CustomProject
  taken: (name: string) => boolean
  onPlace: (p: Placement) => void
  onBlurb: (text: string) => void
  onCustom: (patch: Partial<CustomProject>) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(item.name)
  const [nameError, setNameError] = useState<string | null>(null)
  const text = custom ? custom.blurb : blurb

  function commitName() {
    const next = name.trim().toLowerCase().replace(/[^a-z0-9.-]+/g, '-')
    if (!next || next === item.name) return setName(item.name)
    if (taken(next)) {
      setNameError(`"${next}" is already a project.`)
      return setName(item.name)
    }
    setNameError(null)
    onCustom({ name: next })
  }

  return (
    <div className="detail">
      <header className="detail-head">
        <h2>{item.name}</h2>
        {item.url && (
          <button type="button" className="btn btn-quiet" onClick={() => window.site.openExternal(item.url)}>
            <ExternalIcon /> {item.url.replace(/^https?:\/\//, '')}
          </button>
        )}
      </header>

      <div className="grid-2">
        {custom ? (
          <label className="field">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
            {nameError && <span className="error small">{nameError}</span>}
          </label>
        ) : (
          <div className="field">
            <span>Source</span>
            <span className="readonly">GitHub repo</span>
          </div>
        )}
        <label className="field">
          Placement
          <select value={placement} onChange={(e) => onPlace(e.target.value as Placement)}>
            <option value="featured">Featured</option>
            <option value="shown">Shown</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
      </div>

      {custom && (
        <div className="grid-2">
          <label className="field">
            Link
            <input type="url" placeholder="https://…" value={custom.url} onChange={(e) => onCustom({ url: e.target.value })} />
          </label>
          <div className="grid-2 tight">
            <label className="field">
              Language / kind
              <input placeholder="Talk, Python…" value={custom.language ?? ''} onChange={(e) => onCustom({ language: e.target.value || undefined })} />
            </label>
            <label className="field">
              Date
              <input type="date" value={custom.date ?? ''} onChange={(e) => onCustom({ date: e.target.value || undefined })} />
            </label>
          </div>
        </div>
      )}

      <label className="field">
        <span>
          Blurb {!custom && <span className="dim">— leave empty to use the GitHub description</span>}
        </span>
        <textarea
          rows={8}
          className="blurb"
          value={text}
          placeholder={custom ? 'What is it, and why does it exist?' : item.description || 'No GitHub description.'}
          onChange={(e) => (custom ? onCustom({ blurb: e.target.value }) : onBlurb(e.target.value))}
        />
        <span className="counter">
          {text.length} characters{placement === 'featured' ? ' · featured projects show as wide rows' : ''}
        </span>
      </label>

      {!custom && (
        <div className="meta-strip mono small">
          <span className="dim">From GitHub:</span>
          <span>{item.language ?? 'no language'}</span>
          <span>★ {item.stars}</span>
          {item.pushedAt && <span>updated {formatDay(item.pushedAt.slice(0, 10))}</span>}
        </div>
      )}

      {custom && (
        <button type="button" className="btn btn-danger align-start" onClick={onDelete}>
          <TrashIcon /> Remove project
        </button>
      )}
    </div>
  )
}
