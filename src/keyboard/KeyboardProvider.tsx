import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { eventToToken, parseChord } from './matchKeys'
import type { Binding, ScopeDefinition } from './types'

export const CHORD_TIMEOUT_MS = 1200

interface RegisteredScope {
  id: string
  bindings: Binding[]
  priority: number
}

/**
 * Highest priority first; ties go to whichever registered first.
 *
 * React runs a child's effects before its parent's, so among equal-priority
 * scopes the earliest registration is the most deeply nested one — exactly the
 * scope that should win. A scope that mounts later and still needs to take
 * over (an overlay) raises its priority instead of relying on that ordering.
 */
function byPrecedence(scopes: RegisteredScope[]): RegisteredScope[] {
  return scopes
    .map((scope, index) => ({ scope, index }))
    .sort((a, b) => b.scope.priority - a.scope.priority || a.index - b.index)
    .map((entry) => entry.scope)
}

interface KeyboardContextValue {
  register: (scope: RegisteredScope) => () => void
  scopes: RegisteredScope[]
  pending: string[]
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null)

/**
 * Scopes register in a layout effect so registration lands in the same commit
 * that put the list in the DOM.
 *
 * With a plain effect there is a window after a route renders where the new
 * list is on screen but its scope is not registered yet, and a j pressed in
 * that window is silently dropped. useLayoutEffect would warn during
 * prerender, hence the isomorphic switch.
 */
const useRegistrationEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function KeyboardProvider({
  children,
  enabled = true,
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [scopes, setScopes] = useState<RegisteredScope[]>([])
  const [pending, setPending] = useState<string[]>([])

  // The window listener reads the latest scopes through a ref so it is
  // attached once rather than re-bound on every scope change.
  const scopesRef = useRef(scopes)
  scopesRef.current = scopes
  const pendingRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const register = useCallback((scope: RegisteredScope) => {
    setScopes((current) => [...current, scope])
    return () => setScopes((current) => current.filter((s) => s !== scope))
  }, [])

  const clearPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = []
    setPending([])
  }, [])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey) return
      const token = eventToToken(event)
      const sequence = [...pendingRef.current, token]
      const typing = isTypingTarget(event.target)

      // Topmost scope wins; unclaimed keys fall through to lower scopes.
      const ordered = byPrecedence(scopesRef.current).flatMap((scope) => scope.bindings)
      const candidates = ordered.filter((binding) => {
        if (typing && !binding.allowInInput) return false
        const chord = parseChord(binding.keys)
        return (
          chord.length >= sequence.length && sequence.every((stroke, i) => chord[i] === stroke)
        )
      })

      if (candidates.length === 0) {
        clearPending()
        return
      }

      const exact = candidates.find(
        (binding) => parseChord(binding.keys).length === sequence.length,
      )
      if (exact) {
        event.preventDefault()
        clearPending()
        exact.action()
        return
      }

      // A prefix matched but nothing completed: hold it and wait for the rest.
      event.preventDefault()
      pendingRef.current = sequence
      setPending(sequence)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(clearPending, CHORD_TIMEOUT_MS)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, clearPending])

  const value = useMemo(() => ({ register, scopes, pending }), [register, scopes, pending])

  return <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>
}

function useKeyboardContext(): KeyboardContextValue | null {
  return useContext(KeyboardContext)
}

/** Push a scope for the lifetime of the calling component. */
export function useKeyboardScope(scope: ScopeDefinition): void {
  const context = useKeyboardContext()
  const { id, bindings, priority = 0 } = scope

  // Bindings are usually inline literals; a fresh array each render must not
  // churn the registration. Keep the latest in a ref and register once per id.
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  const register = context?.register

  useRegistrationEffect(() => {
    if (!register) return
    const registered: RegisteredScope = {
      id,
      priority,
      get bindings() {
        return bindingsRef.current
      },
    }
    return register(registered)
  }, [register, id, priority])
}

/** Visible bindings across all scopes, topmost first; first definition wins. */
export function useActiveBindings(): Binding[] {
  const context = useKeyboardContext()
  const scopes = context?.scopes
  return useMemo(() => {
    if (!scopes) return []
    const seen = new Set<string>()
    const result: Binding[] = []
    for (const scope of byPrecedence(scopes)) {
      for (const binding of scope.bindings) {
        if (binding.hidden || seen.has(binding.keys)) continue
        seen.add(binding.keys)
        result.push(binding)
      }
    }
    return result
  }, [scopes])
}

export function usePendingChord(): string[] {
  return useKeyboardContext()?.pending ?? []
}
