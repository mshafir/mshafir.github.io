export interface Binding {
  keys: string
  label: string
  action: () => void
  hidden?: boolean
  allowInInput?: boolean
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
