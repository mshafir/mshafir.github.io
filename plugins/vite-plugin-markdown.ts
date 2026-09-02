import { basename } from 'node:path'
import type { Plugin } from 'vite'
import { createHighlighter, type Highlighter as ShikiHighlighter } from 'shiki'
import { parsePost } from './markdown/parse.ts'

/**
 * Compiles `content/posts/*.md` into JS modules exporting a Post object.
 * Parsing and syntax highlighting run here, in Node, at build time — so the
 * browser bundle carries rendered HTML strings and no markdown machinery.
 */
export function markdown(): Plugin {
  let shiki: ShikiHighlighter | undefined

  return {
    name: 'personal-site:markdown',
    enforce: 'pre',

    async buildStart() {
      shiki = await createHighlighter({
        themes: ['github-dark-default'],
        langs: [
          'typescript',
          'javascript',
          'tsx',
          'jsx',
          'python',
          'bash',
          'json',
          'css',
          'html',
          'yaml',
          'markdown',
        ],
      })
    },

    transform(code, id) {
      if (!id.endsWith('.md')) return null

      const slug = basename(id, '.md')
      const loaded = shiki!.getLoadedLanguages()

      const post = parsePost(code, slug, (source, lang) => {
        const language = loaded.includes(lang) ? lang : 'text'
        return shiki!.codeToHtml(source, { lang: language, theme: 'github-dark-default' })
      })

      return { code: `export default ${JSON.stringify(post)}`, map: null }
    },
  }
}
