export interface Binding {
  keys: string
  label: string
  /**
   * Return `false` to decline the key: the provider then offers it to the
   * next matching binding, and to the browser if nobody takes it.
   */
  action: () => void | false
  hidden?: boolean
  allowInInput?: boolean
  /**
   * Keys to display instead of `keys`, for a binding that stands in for a
   * family ("ArrowUp ArrowDown" shown on the ArrowDown binding while ArrowUp
   * stays hidden).
   */
  hint?: string
}

export interface ScopeDefinition {
  id: string
  bindings: Binding[]
  /**
   * Higher wins. Scopes that mount later but must take over anyway — a modal
   * overlay, say — raise this rather than relying on mount order.
   */
  priority?: number
}

/** Priority tiers, so callers never invent bare numbers. */
export const SCOPE_PRIORITY = {
  global: 0,
  list: 10,
  overlay: 100,
} as const
