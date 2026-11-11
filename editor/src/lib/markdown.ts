import { Marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

/**
 * Posts reference images by their site path (`/images/<slug>/photo.png`). The
 * editor window cannot load those directly, so while a post is open its image
 * URLs point at the app's `site-asset://` protocol, which serves `public/`.
 */
export const ASSET_ORIGIN = 'site-asset://site'

const marked = new Marked({ gfm: true })

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
  strongDelimiter: '**',
  hr: '---',
})
turndown.use(gfm)

// The gfm plugin writes single tildes; the site's renderer (marked) and GitHub both read double tildes.
turndown.addRule('strikethrough', {
  filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
  replacement: (content) => `~~${content}~~`,
})

// TipTap wraps list item text in <p>; keep lists tight instead of padding every item with blank lines.
turndown.addRule('tightListItem', {
  filter: 'li',
  replacement(content, node, options) {
    const parent = node.parentNode as HTMLElement | null
    let prefix = `${options.bulletListMarker} `
    if (parent?.nodeName === 'OL') {
      const start = Number(parent.getAttribute('start') ?? '1')
      const index = Array.prototype.indexOf.call(parent.children, node)
      prefix = `${start + index}. `
    }
    const body = content
      .replace(/^\n+/, '')
      .replace(/\n+$/, '')
      .replace(/\n\n+/g, '\n')
      .replace(/\n/gm, `\n${' '.repeat(prefix.length)}`)
    return `${prefix}${body}${node.nextSibling ? '\n' : ''}`
  },
})

/** Markdown body → HTML for the visual editor, with image paths rewritten for the app. */
export function markdownToHtml(markdown: string): string {
  const html = (marked.parse(markdown, { async: false }) as string)
    // marked keeps the code fence's final newline, which the editor shows as an empty last line.
    .replace(/\n<\/code><\/pre>/g, '</code></pre>')
  return html.replace(/(<img[^>]*?\ssrc=")\/(?!\/)/g, `$1${ASSET_ORIGIN}/`)
}

/** HTML from the visual editor → markdown body, with image paths restored to site paths. */
export function htmlToMarkdown(html: string): string {
  const markdown = turndown.turndown(html)
  return `${markdown.split(`${ASSET_ORIGIN}/`).join('/').trim()}\n`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const WORDS_PER_MINUTE = 220

export function wordCount(markdown: string): number {
  return markdown.trim().split(/\s+/).filter(Boolean).length
}

/** Same rounding the site uses, so the number matches what readers see. */
export function readingMinutes(markdown: string): number {
  return Math.max(1, Math.round(wordCount(markdown) / WORDS_PER_MINUTE))
}
