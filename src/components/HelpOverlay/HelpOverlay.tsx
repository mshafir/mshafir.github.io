import { useEffect, useRef } from 'react'
import { useActiveBindings } from '../../keyboard/KeyboardProvider'
import './HelpOverlay.css'

export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bindings = useActiveBindings()
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay__head">
          <h2 className="overlay__title">Keyboard shortcuts</h2>
          <button ref={closeRef} className="overlay__close" onClick={onClose}>
            esc
          </button>
        </div>
        <dl className="overlay__list">
          {bindings.map((binding) => (
            <div className="overlay__row" key={binding.keys}>
              <dt>
                {binding.keys.split(' ').map((token, i) => (
                  <kbd className="overlay__key" key={i}>
                    {token.replace('mod+', '⌘').replace('Enter', '↵')}
                  </kbd>
                ))}
              </dt>
              <dd>{binding.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
