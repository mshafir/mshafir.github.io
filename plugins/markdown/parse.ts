import matter from 'gray-matter'
import { Marked } from 'marked'

export interface Heading {
  depth: number
  text: string
  id: string
}

export interface PostFrontmatter {
  title: string
  date: string
  description: string
  tags: string[]
  draft: boolean
}

export interface Post {
  slug: string
  frontmatter: PostFrontmatter
  html: string
  toc: Heading[]
  readingTime: number
}

export type Highlighter = (code: string, lang: string) => string

const WORDS_PER_MINUTE = 220

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/** gray-matter turns unquoted YAML dates into Date objects; we want yyyy-mm-dd. */
function toIsoDay(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 10)
  return null
}

export function parsePost(raw: string, slug: string, highlight: Highlighter): Post {
  const { data, content } = matter(raw)

  const title = typeof data.title === 'string' ? data.title : null
  if (!title) throw new Error(`Post "${slug}" is missing a "title" in its frontmatter.`)

  const date = toIsoDay(data.date)
  if (!date) throw new Error(`Post "${slug}" is missing a valid "date" in its frontmatter.`)

  const toc: Heading[] = []
  const seen = new Map<string, number>()

  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const plain = text.replace(/<[^>]+>/g, '')
        // Disambiguate repeated heading text so anchors stay unique.
        const base = slugify(plain)
        const count = seen.get(base) ?? 0
        seen.set(base, count + 1)
        const id = count === 0 ? base : `${base}-${count}`
        if (depth >= 2 && depth <= 3) toc.push({ depth, text: plain, id })
        return `<h${depth} id="${id}">${text}</h${depth}>\n`
      },
      code({ text, lang }) {
        return highlight(text, lang ?? '')
      },
    },
  })

  const html = marked.parse(content, { async: false }) as string
  const words = content.trim().split(/\s+/).filter(Boolean).length

  return {
    slug,
    frontmatter: {
      title,
      date,
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      draft: data.draft === true,
    },
    html,
    toc,
    readingTime: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
  }
}
