#!/usr/bin/env node
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Serves dist/ the way GitHub Pages does: an extensionless path resolves to
 * <path>/index.html, and there is no SPA fallback.
 *
 * `vite preview` instead rewrites every extensionless path to the root
 * index.html, so every prerendered page appears to serve the home page and
 * hydrate incorrectly. Previewing through that hides what Pages will actually
 * serve, so this project previews through here instead.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const port = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost')
  let file = join(root, decodeURIComponent(pathname))
  try {
    if (!extname(file)) {
      const entry = await stat(file).catch(() => null)
      file = entry?.isDirectory() ? join(file, 'index.html') : `${file}.html`
    }
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    const notFound = await readFile(join(root, '404.html')).catch(() => '<h1>404</h1>')
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(notFound)
  }
}).listen(port, () => {
  console.log(`Serving dist/ like GitHub Pages: http://localhost:${port}/`)
})
