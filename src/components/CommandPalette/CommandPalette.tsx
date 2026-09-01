import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { allPosts } from '../../content/posts'
import projectData from '../../data/projects.json'
import type { Project } from '../../data/types'
import { fuzzyScore } from './fuzzy'
import './CommandPalette.css'

const projects = projectData as Project[]

interface Command {
  id: string
  label: string
  hint: string
  run: () => void
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => {
      navigate(path)
      onClose()
    }
    return [
      { id: 'nav-home', label: 'Home', hint: 'page', run: go('/') },
      { id: 'nav-projects', label: 'Projects', hint: 'page', run: go('/projects') },
      { id: 'nav-writing', label: 'Writing', hint: 'page', run: go('/writing') },
      { id: 'nav-about', label: 'About', hint: 'page', run: go('/about') },
      ...allPosts.map((post) => ({
        id: `post-${post.slug}`,
        label: post.frontmatter.title,
        hint: 'post',
        run: go(`/writing/${post.slug}`),
      })),
      ...projects.map((project) => ({
        id: `repo-${project.name}`,
        label: project.name,
        hint: 'repo',
        run: () => {
          window.open(project.url, '_blank', 'noopener')
          onClose()
        },
      })),
    ]
  }, [navigate, onClose])

  const results = useMemo(
    () =>
      commands
        .map((command) => ({ command, score: fuzzyScore(query, command.label) }))
        .filter((entry): entry is { command: Command; score: number } => entry.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((entry) => entry.command),
    [commands, query],
  )

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    setQuery('')
    inputRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])

  if (!open) return null

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      setIndex((i) => (i + 1) % Math.max(1, results.length))
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      setIndex((i) => (i - 1 + results.length) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[index]?.run()
    }
  }

  return (
    <div className="overlay overlay--top" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a page, post, or repo…"
          aria-label="Search"
          aria-controls="palette-results"
        />
        <ul className="palette__results" id="palette-results" role="listbox">
          {results.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                className={i === index ? 'palette__item palette__item--active' : 'palette__item'}
                onMouseEnter={() => setIndex(i)}
                onClick={command.run}
              >
                <span>{command.label}</span>
                <span className="palette__hint">{command.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="palette__empty">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
