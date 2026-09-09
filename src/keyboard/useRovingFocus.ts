import { useCallback, useMemo, useRef } from 'react'
import { useKeyboardScope } from './KeyboardProvider'
import { SCOPE_PRIORITY, type Binding } from './types'

/**
 * List navigation that drives real DOM focus rather than a parallel highlight,
 * so the arrow keys and Tab agree with each other and screen readers stay
 * correct.
 *
 * Several lists can share a page. A list only answers an arrow key while focus
 * is inside it, or when no list at all has focus; otherwise it declines and the
 * key falls through to the list that does.
 */
export function useRovingFocus({
  id,
  count,
  label = 'item',
  grid = false,
}: {
  id: string
  count: number
  label?: string
  /** Up/down move by a full row and left/right step across it. */
  grid?: boolean
}) {
  const elements = useRef<(HTMLElement | null)[]>([])

  const itemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      elements.current[index] = element
    },
    [],
  )

  const currentIndex = () =>
    elements.current.findIndex((element) => element === document.activeElement)

  /** True when focus sits in some other roving list, which then owns the key. */
  const focusIsElsewhere = () => {
    const active = document.activeElement
    return active instanceof HTMLElement && active.closest('[data-roving-list]') !== null
  }

  /**
   * Rows as the layout actually rendered them, measured at keypress so a
   * responsive grid and a stack of full-width rows both come out right.
   */
  const rows = () => {
    const byTop = new Map<number, HTMLElement[]>()
    for (const element of elements.current) {
      if (!element) continue
      const row = byTop.get(element.offsetTop) ?? []
      row.push(element)
      byTop.set(element.offsetTop, row)
    }
    return [...byTop.entries()].sort(([a], [b]) => a - b).map(([, row]) => row)
  }

  const step = useCallback(
    (delta: number): void | false => {
      if (count === 0) return false
      const current = currentIndex()
      if (current === -1) {
        if (focusIsElsewhere()) return false
        // Entering from outside: forward lands on the first item, back on the last.
        elements.current[delta > 0 ? 0 : count - 1]?.focus()
        return
      }
      elements.current[(current + delta + count) % count]?.focus()
    },
    [count],
  )

  const stepRow = useCallback(
    (direction: 1 | -1): void | false => {
      const current = elements.current[currentIndex()]
      if (!current) return step(direction)
      const layout = rows()
      const rowIndex = layout.findIndex((row) => row.includes(current))
      const target = layout[rowIndex + direction]
      // Top and bottom rows are edges, not wrap points.
      if (!target) return
      // Nearest column in the next row, so a short last row still lands sensibly.
      const nearest = target.reduce((best, candidate) =>
        Math.abs(candidate.offsetLeft - current.offsetLeft) <
        Math.abs(best.offsetLeft - current.offsetLeft)
          ? candidate
          : best,
      )
      nearest.focus()
    },
    [step],
  )

  const bindings = useMemo<Binding[]>(() => {
    const numeric: Binding[] = Array.from({ length: 9 }, (_, i) => ({
      keys: String(i + 1),
      label: `jump to ${label} ${i + 1}`,
      hidden: true,
      action: () => elements.current[i]?.focus(),
    }))

    const vertical: Binding[] = grid
      ? [
          {
            keys: 'ArrowDown',
            hint: 'ArrowUp ArrowDown',
            label: `${label}s`,
            action: () => stepRow(1),
          },
          { keys: 'ArrowUp', label: `${label}s up`, hidden: true, action: () => stepRow(-1) },
          {
            keys: 'ArrowRight',
            hint: 'ArrowLeft ArrowRight',
            label: 'across',
            action: () => step(1),
          },
          { keys: 'ArrowLeft', label: `prev ${label}`, hidden: true, action: () => step(-1) },
        ]
      : [
          {
            keys: 'ArrowDown',
            hint: 'ArrowUp ArrowDown',
            label: `${label}s`,
            action: () => step(1),
          },
          { keys: 'ArrowUp', label: `prev ${label}`, hidden: true, action: () => step(-1) },
        ]

    return [
      ...vertical,
      {
        keys: 'Enter',
        label: 'open',
        action: () => {
          const active = document.activeElement as HTMLElement | null
          if (active && elements.current.includes(active)) active.click()
        },
      },
      ...numeric,
    ]
  }, [step, stepRow, label, grid])

  useKeyboardScope({ id, bindings, priority: SCOPE_PRIORITY.list })

  /** Spread onto the list container so other lists can tell focus is taken. */
  const listProps = { 'data-roving-list': id } as const

  return { itemRef, listProps }
}
