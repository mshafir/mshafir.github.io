import { useCallback, useMemo, useRef } from 'react'
import { useKeyboardScope } from './KeyboardProvider'
import { SCOPE_PRIORITY, type Binding } from './types'

/**
 * List navigation that drives real DOM focus rather than a parallel highlight,
 * so j/k and Tab agree with each other and screen readers stay correct.
 */
export function useRovingFocus({
  id,
  count,
  label = 'item',
}: {
  id: string
  count: number
  label?: string
}) {
  const elements = useRef<(HTMLElement | null)[]>([])

  const itemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      elements.current[index] = element
    },
    [],
  )

  const move = useCallback(
    (delta: number) => {
      if (count === 0) return
      const active = document.activeElement as HTMLElement | null
      const current = elements.current.findIndex((element) => element === active)
      // Outside the list: j enters at the top, k enters at the bottom.
      const next = current === -1 ? (delta > 0 ? 0 : count - 1) : (current + delta + count) % count
      elements.current[next]?.focus()
    },
    [count],
  )

  const bindings = useMemo<Binding[]>(() => {
    const numeric: Binding[] = Array.from({ length: 9 }, (_, i) => ({
      keys: String(i + 1),
      label: `jump to ${label} ${i + 1}`,
      hidden: true,
      action: () => elements.current[i]?.focus(),
    }))

    return [
      { keys: 'j', label: `next ${label}`, action: () => move(1) },
      { keys: 'k', label: `prev ${label}`, action: () => move(-1) },
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
  }, [move, label])

  useKeyboardScope({ id, bindings, priority: SCOPE_PRIORITY.list })

  return { itemRef }
}
