import { useActiveBindings, usePendingChord } from '../../keyboard/KeyboardProvider'
import { displayToken } from '../../keyboard/matchKeys'
import './ShortcutBar.css'

const MAX_VISIBLE = 8

export function ShortcutBar() {
  const bindings = useActiveBindings()
  const pending = usePendingChord()

  return (
    <div className="shortcut-bar" role="status" aria-live="off">
      <ul className="shortcut-bar__list">
        {bindings.slice(0, MAX_VISIBLE).map((binding) => (
          <li key={binding.keys} className="shortcut-bar__item">
            {(binding.hint ?? binding.keys).split(' ').map((token, i) => (
              <kbd className="shortcut-bar__key" key={`${binding.keys}-${i}`}>
                {displayToken(token)}
              </kbd>
            ))}
            <span className="shortcut-bar__label">{binding.label}</span>
          </li>
        ))}
      </ul>
      {pending.length > 0 && <span className="shortcut-bar__pending">{pending.join(' ')}…</span>}
    </div>
  )
}
