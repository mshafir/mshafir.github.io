/** Normalize a keydown into the token vocabulary bindings are written in. */
export function eventToToken(event: KeyboardEvent): string {
  const key = event.key
  const base = key.length === 1 ? key.toLowerCase() : key
  // Shift is not encoded: it is already baked into `key` ("?" rather than "/").
  return event.metaKey || event.ctrlKey ? `mod+${base}` : base
}

/** "g h" -> ["g", "h"]; "mod+k" -> ["mod+k"] */
export function parseChord(keys: string): string[] {
  return keys.trim().split(/\s+/)
}

const GLYPHS: Record<string, string> = {
  Enter: '↵',
  Escape: 'esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
}

/** Token -> what to print on a keycap: "mod+k" -> "⌘k", "ArrowUp" -> "↑". */
export function displayToken(token: string): string {
  const base = token.replace('mod+', '')
  return (token.startsWith('mod+') ? '⌘' : '') + (GLYPHS[base] ?? base)
}
