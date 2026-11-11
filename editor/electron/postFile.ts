import matter from 'gray-matter'
import YAML from 'yaml'

export interface PostMeta {
  title: string
  date: string
  description: string
  tags: string[]
  draft: boolean
}

export interface PostFile {
  meta: PostMeta
  /** Frontmatter keys the editor does not manage, kept as-is on save. */
  extra: Record<string, unknown>
  body: string
}

const KNOWN = new Set(['title', 'date', 'description', 'tags', 'draft'])

function toIsoDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

export function parsePostFile(raw: string): PostFile {
  const { data, content } = matter(raw)
  const extra: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) if (!KNOWN.has(key)) extra[key] = value
  return {
    meta: {
      title: typeof data.title === 'string' ? data.title : '',
      date: toIsoDay(data.date),
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      draft: data.draft === true,
    },
    extra,
    body: content.replace(/^\n+/, ''),
  }
}

/** A YAML scalar, quoted only when it has to be. */
function scalar(value: string): string {
  return YAML.stringify(value, { lineWidth: 0 }).trimEnd()
}

export function serializePostFile({ meta, extra, body }: PostFile): string {
  const lines = [
    `title: ${scalar(meta.title || 'Untitled')}`,
    `date: ${meta.date}`,
    `description: ${scalar(meta.description)}`,
    `tags: [${meta.tags.map(scalar).join(', ')}]`,
  ]
  if (meta.draft) lines.push('draft: true')
  if (Object.keys(extra).length) lines.push(YAML.stringify(extra, { lineWidth: 0 }).trimEnd())
  const text = body.trim()
  return `---\n${lines.join('\n')}\n---\n\n${text ? `${text}\n` : ''}`
}
