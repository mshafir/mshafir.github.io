/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Strict CSP for the packaged app; the dev server needs inline scripts for hot reload, so it gets none.
const CSP =
  "default-src 'self'; img-src 'self' site-asset: data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self'"

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  ],
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    include: ['src/**/*.test.ts', 'electron/**/*.test.ts'],
  },
})
