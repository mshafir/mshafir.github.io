import YAML from 'yaml'

export interface CustomProject {
  name: string
  url: string
  blurb: string
  language?: string
  date?: string
}

export interface ProjectsConfig {
  featured: string[]
  hidden: string[]
  /** name → blurb that replaces the GitHub description */
  blurbs: Record<string, string>
  custom: CustomProject[]
}

export function readProjectsConfig(text: string): ProjectsConfig {
  const data = (YAML.parse(text) ?? {}) as Record<string, any>
  const blurbs: Record<string, string> = {}
  for (const [name, override] of Object.entries(data.overrides ?? {})) {
    const blurb = (override as { blurb?: unknown } | null)?.blurb
    if (typeof blurb === 'string') blurbs[name] = blurb
  }
  return {
    featured: (data.featured ?? []).map(String),
    hidden: (data.hidden ?? []).map(String),
    blurbs,
    custom: (data.custom ?? []).map((entry: Record<string, unknown>) => ({
      name: String(entry.name ?? ''),
      url: String(entry.url ?? ''),
      blurb: String(entry.blurb ?? ''),
      ...(entry.language ? { language: String(entry.language) } : {}),
      ...(entry.date ? { date: String(entry.date) } : {}),
    })),
  }
}

interface Edit {
  from: number
  to: number
  text: string
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** `key: value` as YAML, every line indented by `indent` spaces. */
function render(key: string, value: unknown, indent: number): string {
  const pad = ' '.repeat(indent)
  return YAML.stringify({ [key]: value }, { lineWidth: 0 })
    .trimEnd()
    .split('\n')
    .map((line) => pad + line)
    .join('\n')
}

/** Block collections' ranges run on over trailing blank lines; pull an end back to the last real character. */
const contentEnd = (text: string, at: number) => {
  while (at > 0 && /\s/.test(text[at - 1])) at--
  return at
}
const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1
const lineEnd = (text: string, at: number) => {
  const end = text.indexOf('\n', at)
  return end === -1 ? text.length : end + 1
}

/**
 * Apply the editor's view of the config to the existing YAML text. Only the
 * entries that changed are rewritten; everything else, including comments and
 * hand-wrapped blurbs, is copied through untouched so git diffs stay small.
 */
export function writeProjectsConfig(text: string, config: ProjectsConfig): string {
  const current = readProjectsConfig(text)
  const doc = YAML.parseDocument(text)
  const root = doc.contents instanceof YAML.YAMLMap ? doc.contents : null
  const edits: Edit[] = []
  let appended = ''

  const topPair = (key: string) => root?.items.find((pair) => (pair.key as YAML.Scalar)?.value === key)
  const pairRange = (pair: YAML.Pair) => {
    const key = pair.key as YAML.Scalar
    const value = pair.value as YAML.Node | null
    return { from: lineStart(text, key.range![0]), end: contentEnd(text, (value ?? key).range![1]) }
  }
  const setTop = (key: string, value: unknown, keep: boolean) => {
    const pair = topPair(key)
    if (!pair) {
      if (keep) appended += `\n${render(key, value, 0)}\n`
      return
    }
    const { from, end } = pairRange(pair)
    if (keep) edits.push({ from, to: end, text: render(key, value, 0) })
    else edits.push({ from, to: lineEnd(text, end), text: '' })
  }

  if (!same(current.featured, config.featured)) setTop('featured', config.featured, true)
  if (!same(current.hidden, config.hidden)) setTop('hidden', config.hidden, true)
  if (!same(current.custom, config.custom)) setTop('custom', config.custom, config.custom.length > 0)

  if (!same(current.blurbs, config.blurbs)) {
    const pair = topPair('overrides')
    const entries = pair?.value instanceof YAML.YAMLMap ? pair.value : null
    const asOverrides = Object.fromEntries(Object.entries(config.blurbs).map(([name, blurb]) => [name, { blurb }]))
    if (!pair || !entries || entries.items.length === 0) {
      setTop('overrides', asOverrides, Object.keys(asOverrides).length > 0)
    } else {
      const indent = (entries.items[0].key as YAML.Scalar).range![0] - lineStart(text, (entries.items[0].key as YAML.Scalar).range![0])
      for (const entry of entries.items) {
        const name = String((entry.key as YAML.Scalar).value)
        const { from, end } = pairRange(entry)
        if (!(name in config.blurbs)) edits.push({ from, to: lineEnd(text, end), text: '' })
        else if (current.blurbs[name] !== config.blurbs[name]) {
          edits.push({ from, to: end, text: render(name, { blurb: config.blurbs[name] }, indent) })
        }
      }
      const added = Object.keys(config.blurbs).filter((name) => !(name in current.blurbs))
      if (added.length) {
        const at = contentEnd(text, entries.range![1])
        const insert = added.map((name) => render(name, { blurb: config.blurbs[name] }, indent)).join('\n')
        edits.push({ from: at, to: at, text: `\n${insert}` })
      }
    }
  }

  let out = text
  for (const edit of edits.sort((a, b) => b.from - a.from)) out = out.slice(0, edit.from) + edit.text + out.slice(edit.to)
  if (appended) out = `${out.replace(/\n*$/, '\n')}${appended}`
  return out
}
