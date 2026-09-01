# Personal Portfolio + Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static React portfolio and blog with a cursor-reactive voxel self-portrait hero, matrix-rain GitHub project tiles, and full terminal-style keyboard navigation.

**Architecture:** Vite + React + TypeScript, prerendered to static HTML per route by `vite-react-ssg` and hosted on GitHub Pages. Three build-time pipelines produce committed artifacts (voxel geometry from a photo, curated GitHub repo data, compiled markdown posts) so the client ships no parsers and the build never needs network access. A scope-stack keyboard registry drives real DOM focus, so shortcuts layer on top of native accessibility rather than replacing it.

**Tech Stack:** Vite 8, React 19, TypeScript, vite-react-ssg 0.9, react-router-dom 6.30, three 0.185 + @react-three/fiber 9, sharp (build-time), shiki 4 (build-time), gray-matter, Vitest 4 + Testing Library, plain CSS with custom properties.

**Spec:** `docs/superpowers/specs/2026-09-01-personal-site-design.md`

## Global Constraints

- Deploy target is GitHub Pages at the **root** path (`mshafir.github.io`). Vite `base` stays `/`. No router basename.
- Dark theme only. No light mode, no theme toggle.
- Design tokens, verbatim: `--bg #0B0E13`, `--bg-raised #12161E`, `--text #E8E6E1`, `--dim #6B7280`, `--accent #22D3EE`, `--border #1F2630`.
- Single responsive breakpoint: `768px`. Below it, no `ShortcutBar`, no `CommandPalette`, no global key handlers.
- `prefers-reduced-motion: reduce` must be honored by the voxel hero, the tile rain, and all transitions.
- All build-time artifacts (`src/data/voxels.json`, `src/data/projects.json`) are **committed to git**. A build must succeed with no network.
- No CMS, comments, newsletter, or analytics. No light theme. No 360-degree sculpted head.
- Every interactive element must have a visible `:focus-visible` ring in `--accent`.
- Peer-dependency constraint: `vite-react-ssg@0.9.2` requires `react-router-dom@^6.14.1`. Use `6.30.6`, **not** v7.

---

### Task 1: Project scaffold, tooling, and design tokens

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/styles/tokens.css`, `src/styles/base.css`
- Create: `src/vitest.setup.ts`
- Create: `src/lib/smoke.ts`, `src/lib/smoke.test.ts`
- Create: `assets/source/headshot.png` (copied from the image cache)

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm test` / `npm run build` harness. CSS custom properties named exactly as in Global Constraints, defined on `:root` in `src/styles/tokens.css`. Font stack variables `--font-mono` and `--font-sans`.

- [ ] **Step 1: Initialize the package and install dependencies**

```bash
cd /home/mshafir/workspace/personal-site
npm init -y
npm pkg set name="personal-site" private=true type="module" version="0.1.0"
npm pkg delete main
npm install react@19 react-dom@19 react-router-dom@6.30.6 three@0.185 @react-three/fiber@9 vite-react-ssg@0.9.2
npm install -D vite@8 @vitejs/plugin-react typescript vitest@4 jsdom \
  @testing-library/react @testing-library/user-event @testing-library/jest-dom \
  @types/react @types/react-dom @types/three sharp shiki gray-matter marked
```

- [ ] **Step 2: Add npm scripts**

```bash
npm pkg set scripts.dev="vite"
npm pkg set scripts.build="vite-react-ssg build"
npm pkg set scripts.preview="vite preview"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.data:voxels="node scripts/build-voxels.mjs"
npm pkg set scripts.data:github="node scripts/fetch-github.mjs"
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules
dist
.vite
.DS_Store
*.local
```

- [ ] **Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "plugins", "vite.config.ts"]
}
```

- [ ] **Step 5: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  ssgOptions: {
    script: 'async',
    formatting: 'minify',
    dirStyle: 'nested',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs', 'plugins/**/*.test.ts'],
  },
} as never)
```

Note: `ssgOptions` is an extra key that `vite-react-ssg` reads and Vite's own
type does not declare, hence the cast. If the cast causes trouble, move
`ssgOptions` into a separate object spread instead.

- [ ] **Step 6: Create `src/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'

// jsdom has no matchMedia; stub it so components that check
// prefers-reduced-motion and the desktop breakpoint render deterministically.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

// jsdom has no IntersectionObserver; the rain canvases construct one on mount.
if (!('IntersectionObserver' in window)) {
  class StubObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds = []
  }
  window.IntersectionObserver = StubObserver as unknown as typeof IntersectionObserver
}
```

- [ ] **Step 7: Create `src/styles/tokens.css`**

```css
:root {
  --bg: #0B0E13;
  --bg-raised: #12161E;
  --text: #E8E6E1;
  --dim: #6B7280;
  --accent: #22D3EE;
  --border: #1F2630;

  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Inter, sans-serif;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --shortcut-bar-height: 2.5rem;
  --measure: 68ch;
}
```

- [ ] **Step 8: Create `src/styles/base.css`**

```css
@import './tokens.css';
@import './prose.css';

*, *::before, *::after { box-sizing: border-box; }

html { color-scheme: dark; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--accent);
  color: var(--bg);
  padding: var(--space-2) var(--space-4);
  z-index: 100;
  font-family: var(--font-mono);
}
.skip-link:focus { left: 0; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Create a stub `src/styles/prose.css` containing only `/* filled in Task 11 */`
so the import resolves now.

- [ ] **Step 9: Copy the headshot source image**

```bash
mkdir -p assets/source
cp /home/mshafir/.claude-personal/image-cache/1d11c07d-72ee-41d3-96b3-037195159151/2.png assets/source/headshot.png
```

- [ ] **Step 10: Write a smoke test proving the harness runs**

Create `src/lib/smoke.ts`:

```ts
export const siteName = 'Michael Shafir'
```

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { siteName } from './smoke'

describe('test harness', () => {
  it('runs and resolves modules', () => {
    expect(siteName).toBe('Michael Shafir')
  })
})
```

- [ ] **Step 11: Run the test suite**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold vite + react + typescript project with design tokens"
```

---

### Task 2: Voxel builder

**Files:**
- Create: `scripts/lib/voxelize.mjs`
- Create: `scripts/lib/voxelize.test.mjs`
- Create: `scripts/build-voxels.mjs`
- Create: `src/data/voxels.json` (generated, committed)

**Interfaces:**
- Consumes: `assets/source/headshot.png` from Task 1.
- Produces: `voxelize({ data, width, height }, options) -> { size, count, voxels }` where `voxels` is an array of `[x, y, z, r, g, b]` integer tuples. `data` is a flat RGB `Uint8Array` (3 bytes per pixel, no alpha). Coordinates are grid-centered: `x` and `y` range roughly `-size/2 .. size/2`, `y` increasing **upward**. Also produces the committed artifact `src/data/voxels.json` with that exact shape.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/voxelize.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { voxelize } from './voxelize.mjs'

/**
 * A synthetic RGB image: a green background with a solid red square centered
 * in it. The voxelizer must drop the green and keep the red.
 */
function makeFixture(width, height, squareSize) {
  const data = new Uint8Array(width * height * 3)
  const x0 = Math.floor((width - squareSize) / 2)
  const y0 = Math.floor((height - squareSize) / 2)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3
      const inSquare = x >= x0 && x < x0 + squareSize && y >= y0 && y < y0 + squareSize
      if (inSquare) {
        data[i] = 200; data[i + 1] = 40; data[i + 2] = 40      // red subject
      } else {
        data[i] = 40; data[i + 1] = 160; data[i + 2] = 60      // green bokeh
      }
    }
  }
  return { data, width, height }
}

describe('voxelize', () => {
  const size = 32

  it('drops the green background and keeps the subject', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    // A 64px square in a 128px image at grid size 32 is a 16x16 block of cells.
    expect(result.count).toBe(16 * 16)
    expect(result.size).toBe(size)
  })

  it('keeps only subject-colored voxels', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const [, , , r, g, b] of result.voxels) {
      expect(r).toBeGreaterThan(g)
      expect(r).toBeGreaterThan(b)
    }
  })

  it('centers coordinates on the origin', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    const xs = result.voxels.map((v) => v[0])
    const ys = result.voxels.map((v) => v[1])
    expect(Math.abs(Math.min(...xs) + Math.max(...xs))).toBeLessThanOrEqual(1)
    expect(Math.abs(Math.min(...ys) + Math.max(...ys))).toBeLessThanOrEqual(1)
  })

  it('assigns depth so central cells sit forward of edge cells', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    const byDistance = [...result.voxels].sort(
      (a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]),
    )
    expect(byDistance[0][2]).toBeGreaterThan(byDistance[byDistance.length - 1][2])
  })

  it('emits integer tuples of exactly six numbers', () => {
    const result = voxelize(makeFixture(128, 128, 64), { size })
    for (const v of result.voxels) {
      expect(v).toHaveLength(6)
      for (const n of v) expect(Number.isInteger(n)).toBe(true)
    }
  })

  it('returns nothing when the whole image is background', () => {
    const width = 64, height = 64
    const data = new Uint8Array(width * height * 3)
    for (let i = 0; i < data.length; i += 3) {
      data[i] = 40; data[i + 1] = 160; data[i + 2] = 60
    }
    expect(voxelize({ data, width, height }, { size }).count).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lib/voxelize.test.mjs`
Expected: FAIL — cannot resolve `./voxelize.mjs`.

- [ ] **Step 3: Implement the voxelizer**

Create `scripts/lib/voxelize.mjs`:

```js
/**
 * Turn a photo into a bas-relief voxel grid.
 *
 * Pipeline: downsample to an N x N grid of average colors, cut the background
 * by flooding inward from the border, then give each surviving cell a depth
 * built from a radial "head dome" plus luminance relief.
 */

export const DEFAULTS = {
  size: 64,          // grid resolution (N x N cells)
  domeDepth: 10,     // voxels of curvature across the head
  reliefDepth: 4,    // voxels of feature relief from brightness
  bgTolerance: 60,   // euclidean RGB distance for the background flood fill
  greenBias: 1.02,   // g must exceed r and b by this factor to read as bokeh
}

const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255

/** Average each grid cell's color from the source pixels it covers. */
function downsample({ data, width, height }, size) {
  const cells = new Array(size * size)
  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const x0 = Math.floor((gx * width) / size)
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * width) / size))
      const y0 = Math.floor((gy * height) / size)
      const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * height) / size))
      let r = 0, g = 0, b = 0, n = 0
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * width + x) * 3
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++
        }
      }
      cells[gy * size + gx] = { r: r / n, g: g / n, b: b / n }
    }
  }
  return cells
}

const distance = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)

const isBokeh = (c, greenBias) => c.g > c.r * greenBias && c.g > c.b * greenBias

/**
 * Mark background cells by breadth-first flood fill inward from the border.
 * A cell joins the background if it reads as bokeh green, or if it is close in
 * color to the neighbor that reached it. Comparing against the *neighbor*
 * rather than one global seed lets the fill follow a gradient.
 */
function findBackground(cells, size, { bgTolerance, greenBias }) {
  const bg = new Uint8Array(size * size)
  const queue = []

  const seed = (idx) => {
    if (bg[idx]) return
    bg[idx] = 1
    queue.push(idx)
  }

  for (let i = 0; i < size; i++) {
    for (const idx of [i, (size - 1) * size + i, i * size, i * size + size - 1]) {
      if (isBokeh(cells[idx], greenBias)) seed(idx)
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const cx = idx % size
    const cy = Math.floor(idx / size)
    for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
      const nIdx = ny * size + nx
      if (bg[nIdx]) continue
      const candidate = cells[nIdx]
      if (isBokeh(candidate, greenBias) || distance(candidate, cells[idx]) < bgTolerance) {
        seed(nIdx)
      }
    }
  }

  return bg
}

/** Keep only the largest 4-connected foreground blob, dropping stray specks. */
function largestComponent(bg, size) {
  const label = new Int32Array(size * size).fill(-1)
  let best = -1
  let bestSize = 0
  let current = 0

  for (let start = 0; start < bg.length; start++) {
    if (bg[start] || label[start] !== -1) continue
    const queue = [start]
    label[start] = current
    let count = 0
    let head = 0
    while (head < queue.length) {
      const idx = queue[head++]
      count++
      const cx = idx % size
      const cy = Math.floor(idx / size)
      for (const [nx, ny] of [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue
        const nIdx = ny * size + nx
        if (bg[nIdx] || label[nIdx] !== -1) continue
        label[nIdx] = current
        queue.push(nIdx)
      }
    }
    if (count > bestSize) { bestSize = count; best = current }
    current++
  }

  return { label, best }
}

export function voxelize(image, options = {}) {
  const opts = { ...DEFAULTS, ...options }
  const { size, domeDepth, reliefDepth } = opts

  const cells = downsample(image, size)
  const bg = findBackground(cells, size, opts)
  const { label, best } = largestComponent(bg, size)

  const half = size / 2
  const voxels = []

  for (let gy = 0; gy < size; gy++) {
    for (let gx = 0; gx < size; gx++) {
      const idx = gy * size + gx
      if (bg[idx] || label[idx] !== best) continue

      const cell = cells[idx]
      // Normalized offset from the grid center, in the range -1..1.
      const u = (gx + 0.5 - half) / half
      const v = (gy + 0.5 - half) / half
      // Radial dome: full depth at center, zero at the silhouette edge.
      const dome = Math.sqrt(Math.max(0, 1 - (u * u + v * v)))
      const z = Math.round(dome * domeDepth + luma(cell.r, cell.g, cell.b) * reliefDepth)

      voxels.push([
        Math.round(gx - half),
        Math.round(half - gy),   // flip so +y is up in three.js world space
        z,
        Math.round(cell.r),
        Math.round(cell.g),
        Math.round(cell.b),
      ])
    }
  }

  return { size, count: voxels.length, voxels }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lib/voxelize.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the build script**

Create `scripts/build-voxels.mjs`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { voxelize } from './lib/voxelize.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(root, 'assets/source/headshot.png')
const OUTPUT = resolve(root, 'src/data/voxels.json')

const { data, info } = await sharp(await readFile(SOURCE))
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const result = voxelize({ data, width: info.width, height: info.height }, { size: 64 })

if (result.count === 0) {
  console.error('Voxelizer produced no voxels — check the background tolerance.')
  process.exit(1)
}

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, JSON.stringify(result))

const kb = (JSON.stringify(result).length / 1024).toFixed(1)
console.log(`Wrote ${result.count} voxels (${kb} KB) to src/data/voxels.json`)
```

- [ ] **Step 6: Generate the voxel data and sanity-check it**

Run: `npm run data:voxels`
Expected: a count between roughly 1,500 and 3,500. If the count approaches
`64*64 = 4096`, the background was not cut — raise `bgTolerance`. If it is under
800, the fill ate the subject — lower `bgTolerance`. Tune `DEFAULTS` and re-run
until the count lands in range.

- [ ] **Step 7: Commit**

```bash
git add scripts src/data/voxels.json
git commit -m "feat: voxelize headshot into committed voxel grid"
```

---

### Task 3: GitHub project data and curation

**Files:**
- Create: `scripts/lib/curate.mjs`
- Create: `scripts/lib/curate.test.mjs`
- Create: `scripts/fetch-github.mjs`
- Create: `content/projects.config.json`
- Create: `src/data/projects.json` (generated, committed)
- Create: `src/data/types.ts`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces: `curate(repos, config) -> Project[]` and the TypeScript types

```ts
export interface Project {
  name: string
  url: string
  blurb: string
  language: string | null
  stars: number
  pushedAt: string
  featured: boolean
}
export interface VoxelData { size: number; count: number; voxels: number[][] }
```

  Ordering: featured projects first in the order listed in `config.featured`, then the rest sorted by `pushedAt` descending.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/curate.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { curate } from './curate.mjs'

const repos = [
  { name: 'reactlit', html_url: 'u/reactlit', description: 'gh blurb', language: 'TypeScript', stargazers_count: 12, pushed_at: '2025-04-25T00:00:00Z', fork: false },
  { name: 'auto-adventure', html_url: 'u/auto', description: 'ai game', language: 'TypeScript', stargazers_count: 1, pushed_at: '2026-08-17T00:00:00Z', fork: false },
  { name: 'weddingsite', html_url: 'u/wed', description: 'personal', language: 'HTML', stargazers_count: 0, pushed_at: '2019-03-29T00:00:00Z', fork: false },
  { name: 'vislib', html_url: 'u/vislib', description: 'viz', language: 'Python', stargazers_count: 3, pushed_at: '2018-06-07T00:00:00Z', fork: false },
  { name: 'somebodys-repo', html_url: 'u/fork', description: 'a fork', language: 'Go', stargazers_count: 99, pushed_at: '2026-01-01T00:00:00Z', fork: true },
]

const config = {
  featured: ['auto-adventure', 'reactlit'],
  hidden: ['weddingsite'],
  overrides: { reactlit: { blurb: 'A faster way to build React apps.' } },
}

describe('curate', () => {
  it('drops forks', () => {
    expect(curate(repos, config).map((p) => p.name)).not.toContain('somebodys-repo')
  })

  it('drops hidden repos', () => {
    expect(curate(repos, config).map((p) => p.name)).not.toContain('weddingsite')
  })

  it('orders featured repos first, in configured order', () => {
    expect(curate(repos, config).map((p) => p.name).slice(0, 2))
      .toEqual(['auto-adventure', 'reactlit'])
  })

  it('sorts non-featured repos by most recent push', () => {
    const extra = [...repos, {
      name: 'multilaunch', html_url: 'u/ml', description: 'cli', language: 'TypeScript',
      stargazers_count: 1, pushed_at: '2021-11-11T00:00:00Z', fork: false,
    }]
    const tail = curate(extra, config).filter((p) => !p.featured).map((p) => p.name)
    expect(tail).toEqual(['multilaunch', 'vislib'])
  })

  it('marks featured projects', () => {
    const byName = Object.fromEntries(curate(repos, config).map((p) => [p.name, p]))
    expect(byName['auto-adventure'].featured).toBe(true)
    expect(byName['vislib'].featured).toBe(false)
  })

  it('prefers an override blurb over the GitHub description', () => {
    const byName = Object.fromEntries(curate(repos, config).map((p) => [p.name, p]))
    expect(byName['reactlit'].blurb).toBe('A faster way to build React apps.')
    expect(byName['vislib'].blurb).toBe('viz')
  })

  it('falls back to an empty blurb when GitHub has no description', () => {
    const bare = [{ name: 'bare', html_url: 'u/bare', description: null, language: null, stargazers_count: 0, pushed_at: '2020-01-01T00:00:00Z', fork: false }]
    expect(curate(bare, { featured: [], hidden: [], overrides: {} })[0].blurb).toBe('')
  })

  it('tolerates a config missing optional keys', () => {
    expect(() => curate(repos, {})).not.toThrow()
    expect(curate(repos, {}).length).toBe(4)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/lib/curate.test.mjs`
Expected: FAIL — cannot resolve `./curate.mjs`.

- [ ] **Step 3: Implement curation**

Create `scripts/lib/curate.mjs`:

```js
/**
 * Merge the raw GitHub repo listing with hand-authored curation: hide repos,
 * pin a featured order, and override blurbs.
 */
export function curate(repos, config = {}) {
  const featured = config.featured ?? []
  const hidden = new Set(config.hidden ?? [])
  const overrides = config.overrides ?? {}

  const projects = repos
    .filter((repo) => !repo.fork && !hidden.has(repo.name))
    .map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      blurb: overrides[repo.name]?.blurb ?? repo.description ?? '',
      language: repo.language ?? null,
      stars: repo.stargazers_count ?? 0,
      pushedAt: repo.pushed_at,
      featured: featured.includes(repo.name),
    }))

  const rank = (project) =>
    project.featured ? featured.indexOf(project.name) : Number.MAX_SAFE_INTEGER

  return projects.sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) return byRank
    return b.pushedAt.localeCompare(a.pushedAt)
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/lib/curate.test.mjs`
Expected: PASS, 8 tests.

- [ ] **Step 5: Create the curation config**

Create `content/projects.config.json`:

```json
{
  "featured": ["auto-adventure", "reactlit", "react-element-replace", "vislib", "codenames-ai", "multilaunch"],
  "hidden": ["weddingsite", "kavod-crm", "ember-java-starter-kit"],
  "overrides": {
    "auto-adventure": {
      "blurb": "A terminal adventure game whose maps, rooms and encounters are generated on the fly by an LLM."
    },
    "reactlit": {
      "blurb": "A faster way to build React apps — Streamlit's ergonomics without leaving the React ecosystem."
    },
    "react-element-replace": {
      "blurb": "A component that rewrites its own subtree, replacing matching elements as they render."
    },
    "vislib": {
      "blurb": "Web-based visualizations for Python and IPython notebooks."
    },
    "codenames-ai": {
      "blurb": "An agent that plays Codenames, reasoning over word embeddings to find the clue linking the most cards."
    },
    "multilaunch": {
      "blurb": "A small CLI for running and supervising several processes at once."
    }
  }
}
```

- [ ] **Step 6: Write the fetch script**

Create `scripts/fetch-github.mjs`:

```js
#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { curate } from './lib/curate.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = resolve(root, 'content/projects.config.json')
const OUTPUT = resolve(root, 'src/data/projects.json')
const USER = 'mshafir'

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': `${USER}-site` }
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`

const response = await fetch(
  `https://api.github.com/users/${USER}/repos?sort=pushed&per_page=100`,
  { headers },
)

// Exit without writing on failure: a network blip must never blank the
// committed artifact the build depends on.
if (!response.ok) {
  console.error(`GitHub API returned ${response.status} ${response.statusText}`)
  console.error('Leaving the existing src/data/projects.json untouched.')
  process.exit(1)
}

const config = JSON.parse(await readFile(CONFIG, 'utf8'))
const projects = curate(await response.json(), config)

await mkdir(dirname(OUTPUT), { recursive: true })
await writeFile(OUTPUT, `${JSON.stringify(projects, null, 2)}\n`)

console.log(`Wrote ${projects.length} projects (${projects.filter((p) => p.featured).length} featured)`)
```

- [ ] **Step 7: Create the shared types and fetch the data**

Create `src/data/types.ts`:

```ts
export interface Project {
  name: string
  url: string
  blurb: string
  language: string | null
  stars: number
  pushedAt: string
  featured: boolean
}

export interface VoxelData {
  size: number
  count: number
  /** [x, y, z, r, g, b] */
  voxels: number[][]
}
```

Run: `npm run data:github`
Expected: "Wrote N projects (6 featured)".

- [ ] **Step 8: Commit**

```bash
git add scripts content/projects.config.json src/data
git commit -m "feat: fetch and curate github projects at build time"
```

---
### Task 4: Markdown post pipeline

**Files:**
- Create: `plugins/markdown/parse.ts`
- Create: `plugins/markdown/parse.test.ts`
- Create: `plugins/vite-plugin-markdown.ts`
- Create: `content/posts/hello-world.md`
- Create: `src/content/posts.ts`
- Create: `src/types/markdown.d.ts`
- Modify: `vite.config.ts` (register the plugin)

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:

```ts
export interface Heading { depth: number; text: string; id: string }
export interface PostFrontmatter {
  title: string
  date: string          // ISO yyyy-mm-dd
  description: string
  tags: string[]
  draft: boolean
}
export interface Post {
  slug: string
  frontmatter: PostFrontmatter
  html: string
  toc: Heading[]
  readingTime: number   // whole minutes, minimum 1
}
export type Highlighter = (code: string, lang: string) => string
export function parsePost(raw: string, slug: string, highlight: Highlighter): Post
```

  And from `src/content/posts.ts`: `allPosts: Post[]` (newest first, drafts filtered in production), `postSlugs: string[]`, `getPost(slug): Post | undefined`, `getAdjacentPosts(slug): { previous?: Post; next?: Post }`.

- [ ] **Step 1: Write the failing test**

Create `plugins/markdown/parse.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parsePost } from './parse'

const passthrough = (code: string, lang: string) =>
  `<pre data-lang="${lang}"><code>${code}</code></pre>`

const sample = [
  '---',
  'title: On Agent Architecture',
  'date: 2026-08-14',
  'description: Why the interesting part is the boundary.',
  'tags: [ai, architecture]',
  '---',
  '',
  'Some opening prose.',
  '',
  '## First section',
  '',
  'More prose with `inline code`.',
  '',
  '### A nested heading',
  '',
  '```ts',
  'const x: number = 1',
  '```',
  '',
  '## Second section',
  '',
  'Closing prose.',
  '',
].join('\n')

describe('parsePost', () => {
  it('parses frontmatter fields', () => {
    const post = parsePost(sample, 'on-agent-architecture', passthrough)
    expect(post.frontmatter.title).toBe('On Agent Architecture')
    expect(post.frontmatter.date).toBe('2026-08-14')
    expect(post.frontmatter.description).toBe('Why the interesting part is the boundary.')
    expect(post.frontmatter.tags).toEqual(['ai', 'architecture'])
  })

  it('defaults draft to false, tags to empty, description to empty', () => {
    const minimal = '---\ntitle: T\ndate: 2026-01-01\n---\n\nBody.\n'
    const post = parsePost(minimal, 't', passthrough)
    expect(post.frontmatter.draft).toBe(false)
    expect(post.frontmatter.tags).toEqual([])
    expect(post.frontmatter.description).toBe('')
  })

  it('keeps the slug it was given', () => {
    expect(parsePost(sample, 'my-slug', passthrough).slug).toBe('my-slug')
  })

  it('renders markdown to html', () => {
    const post = parsePost(sample, 's', passthrough)
    expect(post.html).toContain('<p>Some opening prose.</p>')
    expect(post.html).toContain('<code>inline code</code>')
  })

  it('extracts a table of contents with slugified ids', () => {
    expect(parsePost(sample, 's', passthrough).toc).toEqual([
      { depth: 2, text: 'First section', id: 'first-section' },
      { depth: 3, text: 'A nested heading', id: 'a-nested-heading' },
      { depth: 2, text: 'Second section', id: 'second-section' },
    ])
  })

  it('gives headings anchor ids matching the toc', () => {
    expect(parsePost(sample, 's', passthrough).html).toContain('id="first-section"')
  })

  it('disambiguates repeated heading text', () => {
    const dupes = '---\ntitle: T\ndate: 2026-01-01\n---\n\n## Notes\n\n## Notes\n'
    expect(parsePost(dupes, 'd', passthrough).toc.map((h) => h.id)).toEqual(['notes', 'notes-1'])
  })

  it('routes fenced code through the highlighter with its language', () => {
    expect(parsePost(sample, 's', passthrough).html).toContain('data-lang="ts"')
  })

  it('estimates reading time at a minimum of one minute', () => {
    expect(parsePost(sample, 's', passthrough).readingTime).toBeGreaterThanOrEqual(1)
  })

  it('scales reading time with length', () => {
    const long = `---\ntitle: T\ndate: 2026-01-01\n---\n\n${'word '.repeat(2000)}`
    expect(parsePost(long, 'l', passthrough).readingTime).toBeGreaterThan(5)
  })

  it('throws naming the slug and the field when title is missing', () => {
    const bad = '---\ndate: 2026-01-01\n---\n\nBody.\n'
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/broken/)
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/title/)
  })

  it('throws when date is missing', () => {
    const bad = '---\ntitle: T\n---\n\nBody.\n'
    expect(() => parsePost(bad, 'broken', passthrough)).toThrow(/date/)
  })

  it('normalizes a Date-typed frontmatter date to an ISO day string', () => {
    const withDate = '---\ntitle: T\ndate: 2026-03-04\n---\n\nBody.\n'
    expect(parsePost(withDate, 'd', passthrough).frontmatter.date).toBe('2026-03-04')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run plugins/markdown/parse.test.ts`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 3: Implement the parser**

Create `plugins/markdown/parse.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run plugins/markdown/parse.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Write the Vite plugin**

Create `plugins/vite-plugin-markdown.ts`:

```ts
import { basename } from 'node:path'
import type { Plugin } from 'vite'
import { createHighlighter, type Highlighter as ShikiHighlighter } from 'shiki'
import { parsePost } from './markdown/parse'

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
          'typescript', 'javascript', 'tsx', 'jsx', 'python',
          'bash', 'json', 'css', 'html', 'yaml', 'markdown',
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
```

- [ ] **Step 6: Register the plugin and declare the module type**

Modify `vite.config.ts`: add `import { markdown } from './plugins/vite-plugin-markdown'`
and change the plugins array to `plugins: [markdown(), react()]` — markdown must
run **before** react.

Create `src/types/markdown.d.ts`:

```ts
declare module '*.md' {
  import type { Post } from '../../plugins/markdown/parse'
  const post: Post
  export default post
}
```

- [ ] **Step 7: Write the starter post**

Create `content/posts/hello-world.md`. Note that the fenced block below is
indented inside this plan for nesting reasons only — write it flush-left in the
actual file.

```markdown
---
title: Hello World
date: 2026-09-01
description: A placeholder first post — the shape of the thing before the thing.
tags: [meta]
---

This is the starter post. It exists so the blog has a shape to check: a title, a
date, a table of contents, code, and prose that runs long enough to see how a
paragraph actually breathes at this measure.

## Why this site exists

Replace this with something real.

## What a code block looks like

    ```ts
    export function useShortcut(keys: string, action: () => void) {
      useKeyboardScope({ id: 'demo', bindings: [{ keys, label: 'do it', action }] })
    }
    ```

## What a list looks like

- One
- Two
- Three

Delete this file when the first real post lands.
```

- [ ] **Step 8: Write the post index**

Create `src/content/posts.ts`:

```ts
import type { Post } from '../../plugins/markdown/parse'

const modules = import.meta.glob<{ default: Post }>('../../content/posts/*.md', { eager: true })

const loaded = Object.values(modules).map((module) => module.default)

/** Drafts stay visible while developing and are stripped from production. */
const visible = import.meta.env.PROD ? loaded.filter((post) => !post.frontmatter.draft) : loaded

export const allPosts: Post[] = visible.sort((a, b) =>
  b.frontmatter.date.localeCompare(a.frontmatter.date),
)

export const postSlugs: string[] = allPosts.map((post) => post.slug)

export function getPost(slug: string): Post | undefined {
  return allPosts.find((post) => post.slug === slug)
}

export function getAdjacentPosts(slug: string): { previous?: Post; next?: Post } {
  const index = allPosts.findIndex((post) => post.slug === slug)
  if (index === -1) return {}
  // allPosts is newest-first, so the newer neighbour sits at a lower index.
  return { next: allPosts[index - 1], previous: allPosts[index + 1] }
}

export type { Post }
```

- [ ] **Step 9: Run the full suite**

Run: `npm test`
Expected: PASS — smoke, voxelize, curate, and parse suites all green.

- [ ] **Step 10: Commit**

```bash
git add plugins content/posts src/content src/types vite.config.ts package.json package-lock.json
git commit -m "feat: compile markdown posts to html at build time with shiki"
```

---

### Task 5: Keyboard registry

**Files:**
- Create: `src/keyboard/types.ts`
- Create: `src/keyboard/matchKeys.ts`
- Create: `src/keyboard/matchKeys.test.ts`
- Create: `src/keyboard/KeyboardProvider.tsx`
- Create: `src/keyboard/KeyboardProvider.test.tsx`

**Interfaces:**
- Consumes: nothing from prior tasks.
- Produces:

```ts
export interface Binding {
  keys: string            // "g h" is a chord; "?" and "mod+k" are single strokes
  label: string           // shown in the shortcut bar
  action: () => void
  hidden?: boolean        // registered but not displayed
  allowInInput?: boolean  // fires even while typing in a field
}
export interface ScopeDefinition { id: string; bindings: Binding[] }

export function eventToToken(event: KeyboardEvent): string
export function parseChord(keys: string): string[]

export const CHORD_TIMEOUT_MS = 1200
export function KeyboardProvider(props: { children: ReactNode; enabled?: boolean }): JSX.Element
export function useKeyboardScope(scope: ScopeDefinition): void   // pushes on mount, pops on unmount
export function useActiveBindings(): Binding[]                   // topmost scope first, deduped by keys
export function usePendingChord(): string[]                      // in-flight chord prefix, for the bar
```

- [ ] **Step 1: Write the failing test for key tokenization**

Create `src/keyboard/matchKeys.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { eventToToken, parseChord } from './matchKeys'

const event = (init: Partial<KeyboardEvent>) => init as KeyboardEvent

describe('eventToToken', () => {
  it('lowercases plain letter keys', () => {
    expect(eventToToken(event({ key: 'G' }))).toBe('g')
  })

  it('keeps named keys in their canonical form', () => {
    expect(eventToToken(event({ key: 'Enter' }))).toBe('Enter')
    expect(eventToToken(event({ key: 'Escape' }))).toBe('Escape')
  })

  it('passes punctuation through', () => {
    expect(eventToToken(event({ key: '/' }))).toBe('/')
    expect(eventToToken(event({ key: '?' }))).toBe('?')
  })

  it('prefixes mod for meta or ctrl', () => {
    expect(eventToToken(event({ key: 'k', metaKey: true }))).toBe('mod+k')
    expect(eventToToken(event({ key: 'k', ctrlKey: true }))).toBe('mod+k')
  })

  it('ignores a lone shift, already reflected in the key value', () => {
    expect(eventToToken(event({ key: '?', shiftKey: true }))).toBe('?')
  })
})

describe('parseChord', () => {
  it('splits a chord on spaces', () => {
    expect(parseChord('g h')).toEqual(['g', 'h'])
  })

  it('returns a single-element array for single strokes', () => {
    expect(parseChord('mod+k')).toEqual(['mod+k'])
    expect(parseChord('?')).toEqual(['?'])
  })

  it('collapses repeated whitespace', () => {
    expect(parseChord('g   p')).toEqual(['g', 'p'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/keyboard/matchKeys.test.ts`
Expected: FAIL — cannot resolve `./matchKeys`.

- [ ] **Step 3: Implement tokenization**

Create `src/keyboard/types.ts`:

```ts
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
}
```

Create `src/keyboard/matchKeys.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/keyboard/matchKeys.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the failing test for the provider**

Create `src/keyboard/KeyboardProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { KeyboardProvider, useKeyboardScope, useActiveBindings } from './KeyboardProvider'
import type { Binding } from './types'

function Scope({ id, bindings, children }: { id: string; bindings: Binding[]; children?: ReactNode }) {
  useKeyboardScope({ id, bindings })
  return <>{children}</>
}

function BindingList() {
  const bindings = useActiveBindings()
  return <ul>{bindings.map((b) => <li key={b.keys}>{`${b.keys}:${b.label}`}</li>)}</ul>
}

describe('KeyboardProvider', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  it('fires a single-stroke binding', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: '?', label: 'help', action }]} />
      </KeyboardProvider>,
    )
    await user().keyboard('?')
    expect(action).toHaveBeenCalledOnce()
  })

  it('fires a chord binding only after the full sequence', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'g h', label: 'home', action }]} />
      </KeyboardProvider>,
    )
    const u = user()
    await u.keyboard('g')
    expect(action).not.toHaveBeenCalled()
    await u.keyboard('h')
    expect(action).toHaveBeenCalledOnce()
  })

  it('abandons a chord after the timeout', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'g h', label: 'home', action }]} />
      </KeyboardProvider>,
    )
    const u = user()
    await u.keyboard('g')
    act(() => { vi.advanceTimersByTime(1500) })
    await u.keyboard('h')
    expect(action).not.toHaveBeenCalled()
  })

  it('lets a higher scope shadow a lower one', async () => {
    const outer = vi.fn()
    const inner = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'x', label: 'outer', action: outer }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: inner }]} />
        </Scope>
      </KeyboardProvider>,
    )
    await user().keyboard('x')
    expect(inner).toHaveBeenCalledOnce()
    expect(outer).not.toHaveBeenCalled()
  })

  it('falls through to a lower scope for unclaimed keys', async () => {
    const outer = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'y', label: 'outer', action: outer }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: vi.fn() }]} />
        </Scope>
      </KeyboardProvider>,
    )
    await user().keyboard('y')
    expect(outer).toHaveBeenCalledOnce()
  })

  it('restores the lower scope when the upper unmounts', async () => {
    const outer = vi.fn()
    function Toggle({ show }: { show: boolean }) {
      return (
        <KeyboardProvider>
          <Scope id="outer" bindings={[{ keys: 'x', label: 'outer', action: outer }]}>
            {show ? <Scope id="inner" bindings={[{ keys: 'x', label: 'inner', action: vi.fn() }]} /> : null}
          </Scope>
        </KeyboardProvider>
      )
    }
    const { rerender } = render(<Toggle show />)
    rerender(<Toggle show={false} />)
    await user().keyboard('x')
    expect(outer).toHaveBeenCalledOnce()
  })

  it('does not fire while typing in an input', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'x', label: 'x', action }]} />
        <input aria-label="field" />
      </KeyboardProvider>,
    )
    const u = user()
    await u.click(screen.getByLabelText('field'))
    await u.keyboard('x')
    expect(action).not.toHaveBeenCalled()
  })

  it('fires in an input when the binding opts in', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[{ keys: 'Escape', label: 'close', action, allowInInput: true }]} />
        <input aria-label="field" />
      </KeyboardProvider>,
    )
    const u = user()
    await u.click(screen.getByLabelText('field'))
    await u.keyboard('{Escape}')
    expect(action).toHaveBeenCalledOnce()
  })

  it('registers nothing when disabled', async () => {
    const action = vi.fn()
    render(
      <KeyboardProvider enabled={false}>
        <Scope id="s" bindings={[{ keys: 'x', label: 'x', action }]} />
      </KeyboardProvider>,
    )
    await user().keyboard('x')
    expect(action).not.toHaveBeenCalled()
  })

  it('exposes active bindings with the topmost scope first', () => {
    render(
      <KeyboardProvider>
        <Scope id="outer" bindings={[{ keys: 'y', label: 'outer-y', action: vi.fn() }]}>
          <Scope id="inner" bindings={[{ keys: 'x', label: 'inner-x', action: vi.fn() }]}>
            <BindingList />
          </Scope>
        </Scope>
      </KeyboardProvider>,
    )
    expect(screen.getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['x:inner-x', 'y:outer-y'])
  })

  it('omits hidden bindings from the active list', () => {
    render(
      <KeyboardProvider>
        <Scope id="s" bindings={[
          { keys: 'x', label: 'shown', action: vi.fn() },
          { keys: 'q', label: 'secret', action: vi.fn(), hidden: true },
        ]}>
          <BindingList />
        </Scope>
      </KeyboardProvider>,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/keyboard/KeyboardProvider.test.tsx`
Expected: FAIL — cannot resolve `./KeyboardProvider`.

- [ ] **Step 7: Implement the provider**

Create `src/keyboard/KeyboardProvider.tsx`:

```tsx
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react'
import { eventToToken, parseChord } from './matchKeys'
import type { Binding, ScopeDefinition } from './types'

export const CHORD_TIMEOUT_MS = 1200

interface RegisteredScope {
  id: string
  bindings: Binding[]
}

interface KeyboardContextValue {
  register: (scope: RegisteredScope) => () => void
  scopes: RegisteredScope[]
  pending: string[]
}

const KeyboardContext = createContext<KeyboardContextValue | null>(null)

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function KeyboardProvider({
  children,
  enabled = true,
}: {
  children: ReactNode
  enabled?: boolean
}) {
  const [scopes, setScopes] = useState<RegisteredScope[]>([])
  const [pending, setPending] = useState<string[]>([])

  // The window listener reads the latest scopes through a ref so it is
  // attached once rather than re-bound on every scope change.
  const scopesRef = useRef(scopes)
  scopesRef.current = scopes
  const pendingRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const register = useCallback((scope: RegisteredScope) => {
    setScopes((current) => [...current, scope])
    return () => setScopes((current) => current.filter((s) => s !== scope))
  }, [])

  const clearPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = []
    setPending([])
  }, [])

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey) return
      const token = eventToToken(event)
      const sequence = [...pendingRef.current, token]
      const typing = isTypingTarget(event.target)

      // Topmost scope wins; unclaimed keys fall through to lower scopes.
      const ordered = [...scopesRef.current].reverse().flatMap((scope) => scope.bindings)
      const candidates = ordered.filter((binding) => {
        if (typing && !binding.allowInInput) return false
        const chord = parseChord(binding.keys)
        return chord.length >= sequence.length &&
          sequence.every((stroke, i) => chord[i] === stroke)
      })

      if (candidates.length === 0) {
        clearPending()
        return
      }

      const exact = candidates.find(
        (binding) => parseChord(binding.keys).length === sequence.length,
      )
      if (exact) {
        event.preventDefault()
        clearPending()
        exact.action()
        return
      }

      // A prefix matched but nothing completed: hold it and wait for the rest.
      event.preventDefault()
      pendingRef.current = sequence
      setPending(sequence)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(clearPending, CHORD_TIMEOUT_MS)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [enabled, clearPending])

  const value = useMemo(() => ({ register, scopes, pending }), [register, scopes, pending])

  return <KeyboardContext.Provider value={value}>{children}</KeyboardContext.Provider>
}

function useKeyboardContext(): KeyboardContextValue | null {
  return useContext(KeyboardContext)
}

/** Push a scope for the lifetime of the calling component. */
export function useKeyboardScope(scope: ScopeDefinition): void {
  const context = useKeyboardContext()
  const { id, bindings } = scope

  // Bindings are usually inline literals; a fresh array each render must not
  // churn the registration. Keep the latest in a ref and register once per id.
  const bindingsRef = useRef(bindings)
  bindingsRef.current = bindings

  const register = context?.register

  useEffect(() => {
    if (!register) return
    const registered: RegisteredScope = {
      id,
      get bindings() {
        return bindingsRef.current
      },
    }
    return register(registered)
  }, [register, id])
}

/** Visible bindings across all scopes, topmost first; first definition wins. */
export function useActiveBindings(): Binding[] {
  const context = useKeyboardContext()
  const scopes = context?.scopes
  return useMemo(() => {
    if (!scopes) return []
    const seen = new Set<string>()
    const result: Binding[] = []
    for (const scope of [...scopes].reverse()) {
      for (const binding of scope.bindings) {
        if (binding.hidden || seen.has(binding.keys)) continue
        seen.add(binding.keys)
        result.push(binding)
      }
    }
    return result
  }, [scopes])
}

export function usePendingChord(): string[] {
  return useKeyboardContext()?.pending ?? []
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/keyboard/KeyboardProvider.test.tsx`
Expected: PASS, 11 tests.

- [ ] **Step 9: Commit**

```bash
git add src/keyboard
git commit -m "feat: keyboard registry with scope stack and chord support"
```

---

### Task 6: Roving focus

**Files:**
- Create: `src/keyboard/useRovingFocus.ts`
- Create: `src/keyboard/useRovingFocus.test.tsx`

**Interfaces:**
- Consumes: `useKeyboardScope` from Task 5.
- Produces:

```ts
export function useRovingFocus(options: {
  id: string
  count: number
  label?: string          // noun used in shortcut labels, default "item"
}): { itemRef: (index: number) => (element: HTMLElement | null) => void }
```

  Registers `j`/`k` (wrapping), `Enter` (clicks the focused element), and hidden `1`-`9` jumps. Movement is relative to the currently focused item; when focus is outside the list, `j` enters at index 0 and `k` at the last index.

- [ ] **Step 1: Write the failing test**

Create `src/keyboard/useRovingFocus.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KeyboardProvider } from './KeyboardProvider'
import { useRovingFocus } from './useRovingFocus'

function List({ items, onActivate }: { items: string[]; onActivate?: (item: string) => void }) {
  const { itemRef } = useRovingFocus({ id: 'list', count: items.length })
  return (
    <ul>
      {items.map((item, index) => (
        <li key={item}>
          <a
            href={`#${item}`}
            ref={itemRef(index)}
            onClick={(event) => { event.preventDefault(); onActivate?.(item) }}
          >
            {item}
          </a>
        </li>
      ))}
    </ul>
  )
}

const setup = (items: string[], onActivate?: (item: string) => void) => {
  render(
    <KeyboardProvider>
      <List items={items} onActivate={onActivate} />
    </KeyboardProvider>,
  )
  return userEvent.setup()
}

describe('useRovingFocus', () => {
  const items = ['alpha', 'beta', 'gamma']

  it('enters the list at the first item on j', async () => {
    const user = setup(items)
    await user.keyboard('j')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('enters at the last item on k', async () => {
    const user = setup(items)
    await user.keyboard('k')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('moves down with j', async () => {
    const user = setup(items)
    await user.keyboard('jj')
    expect(screen.getByText('beta')).toHaveFocus()
  })

  it('moves up with k', async () => {
    const user = setup(items)
    await user.keyboard('jjk')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the last item to the first', async () => {
    const user = setup(items)
    await user.keyboard('jjjj')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('wraps from the first item to the last', async () => {
    const user = setup(items)
    await user.keyboard('jk')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('jumps to the nth item by number', async () => {
    const user = setup(items)
    await user.keyboard('3')
    expect(screen.getByText('gamma')).toHaveFocus()
  })

  it('ignores a number beyond the list length', async () => {
    const user = setup(items)
    await user.keyboard('j9')
    expect(screen.getByText('alpha')).toHaveFocus()
  })

  it('activates the focused item on Enter', async () => {
    const onActivate = vi.fn()
    const user = setup(items, onActivate)
    await user.keyboard('jj')
    await user.keyboard('{Enter}')
    expect(onActivate).toHaveBeenCalledWith('beta')
  })

  it('does nothing on an empty list', async () => {
    render(
      <KeyboardProvider>
        <List items={[]} />
      </KeyboardProvider>,
    )
    const user = userEvent.setup()
    await expect(user.keyboard('j')).resolves.not.toThrow()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/keyboard/useRovingFocus.test.tsx`
Expected: FAIL — cannot resolve `./useRovingFocus`.

- [ ] **Step 3: Implement roving focus**

Create `src/keyboard/useRovingFocus.ts`:

```ts
import { useCallback, useMemo, useRef } from 'react'
import { useKeyboardScope } from './KeyboardProvider'
import type { Binding } from './types'

/**
 * List navigation that drives real DOM focus rather than a parallel highlight,
 * so j/k and Tab agree with each other and screen readers stay correct.
 */
export function useRovingFocus({
  id,
  count,
  label = 'item',
}: {
  id: string
  count: number
  label?: string
}) {
  const elements = useRef<(HTMLElement | null)[]>([])

  const itemRef = useCallback(
    (index: number) => (element: HTMLElement | null) => {
      elements.current[index] = element
    },
    [],
  )

  const move = useCallback(
    (delta: number) => {
      if (count === 0) return
      const active = document.activeElement as HTMLElement | null
      const current = elements.current.findIndex((element) => element === active)
      // Outside the list: j enters at the top, k enters at the bottom.
      const next = current === -1
        ? (delta > 0 ? 0 : count - 1)
        : (current + delta + count) % count
      elements.current[next]?.focus()
    },
    [count],
  )

  const bindings = useMemo<Binding[]>(() => {
    const numeric: Binding[] = Array.from({ length: 9 }, (_, i) => ({
      keys: String(i + 1),
      label: `jump to ${label} ${i + 1}`,
      hidden: true,
      action: () => elements.current[i]?.focus(),
    }))

    return [
      { keys: 'j', label: `next ${label}`, action: () => move(1) },
      { keys: 'k', label: `prev ${label}`, action: () => move(-1) },
      {
        keys: 'Enter',
        label: 'open',
        action: () => {
          const active = document.activeElement as HTMLElement | null
          if (active && elements.current.includes(active)) active.click()
        },
      },
      ...numeric,
    ]
  }, [move, label])

  useKeyboardScope({ id, bindings })

  return { itemRef }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/keyboard/useRovingFocus.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/keyboard
git commit -m "feat: roving focus hook driving real DOM focus"
```

---
### Task 7: App shell, routing, and SSG entry

**Files:**
- Create: `src/main.tsx`, `src/routes.tsx`
- Create: `src/components/Layout/Layout.tsx`, `src/components/Layout/Layout.css`
- Create: `src/components/Layout/Header.tsx`, `src/components/Layout/Header.css`
- Create: `src/components/Seo.tsx`
- Create: `src/hooks/useMediaQuery.ts`, `src/hooks/useMediaQuery.test.tsx`
- Create: `src/pages/Home.tsx`, `Projects.tsx`, `Writing.tsx`, `Post.tsx`, `About.tsx`, `NotFound.tsx`
- Modify: `index.html`

**Interfaces:**
- Consumes: `KeyboardProvider` (Task 5), `postSlugs`/`getPost` (Task 4).
- Produces: `useMediaQuery(query: string): boolean` (SSR-safe, `false` during prerender), `useIsDesktop()`, `usePrefersReducedMotion()`, `<Seo title description path type? />`, and a route table with `getStaticPaths` on `/writing/:slug`.

- [ ] **Step 1: Write the failing test for the media query hook**

Create `src/hooks/useMediaQuery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMediaQuery } from './useMediaQuery'

function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const mql = {
    matches: initialMatches,
    media: '',
    onchange: null,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener) },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener) },
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return {
    emit(matches: boolean) {
      mql.matches = matches
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent))
    },
  }
}

describe('useMediaQuery', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('reports the initial match after mount', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(true)
  })

  it('reports a non-match', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('updates when the media query changes', () => {
    const control = mockMatchMedia(false)
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    act(() => { control.emit(true) })
    expect(result.current).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/hooks/useMediaQuery.test.tsx`
Expected: FAIL — cannot resolve `./useMediaQuery`.

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useMediaQuery.ts`:

```ts
import { useEffect, useState } from 'react'

/**
 * SSR-safe media query. During prerender there is no window, so this returns
 * false and the first client render matches the static HTML exactly; the real
 * value arrives in the effect immediately after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

export const useIsDesktop = () => useMediaQuery('(min-width: 768px)')
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/useMediaQuery.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Create the SEO helper**

Create `src/components/Seo.tsx`:

```tsx
import { Head } from 'vite-react-ssg'

const SITE = 'Michael Shafir'
const ORIGIN = 'https://mshafir.github.io'

export function Seo({
  title,
  description,
  path,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
}) {
  const fullTitle = path === '/' ? `${SITE} — Software Architect` : `${title} — ${SITE}`
  const url = `${ORIGIN}${path}`
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  )
}
```

- [ ] **Step 6: Create the header**

Create `src/components/Layout/Header.tsx`:

```tsx
import { NavLink } from 'react-router-dom'
import './Header.css'

const LINKS = [
  { to: '/', label: 'home', chord: 'g h', end: true },
  { to: '/projects', label: 'projects', chord: 'g p', end: false },
  { to: '/writing', label: 'writing', chord: 'g w', end: false },
  { to: '/about', label: 'about', chord: 'g a', end: false },
]

export function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="header__brand" end>
        michael<span className="header__brand-dim">.shafir</span>
      </NavLink>
      <nav className="header__nav" aria-label="Main">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              isActive ? 'header__link header__link--active' : 'header__link'
            }
          >
            {link.label}
            <span className="header__chord" aria-hidden="true">{link.chord}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
```

Create `src/components/Layout/Header.css`:

```css
.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-6);
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  position: sticky;
  top: 0;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  z-index: 20;
}

.header__brand { text-decoration: none; font-weight: 600; letter-spacing: 0.02em; }
.header__brand-dim { color: var(--dim); }

.header__nav { display: flex; gap: var(--space-6); flex-wrap: wrap; }

.header__link {
  text-decoration: none;
  color: var(--dim);
  transition: color 120ms ease;
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
}

.header__link:hover { color: var(--text); }
.header__link--active { color: var(--accent); }

.header__chord {
  font-size: 0.7rem;
  color: var(--border);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0 var(--space-1);
}

.header__link:hover .header__chord,
.header__link--active .header__chord { color: var(--dim); }

@media (max-width: 767px) {
  .header { padding: var(--space-3) var(--space-4); flex-wrap: wrap; gap: var(--space-3); }
  .header__nav { gap: var(--space-4); width: 100%; }
  /* Chord hints are meaningless without a keyboard. */
  .header__chord { display: none; }
}
```

- [ ] **Step 7: Create the layout**

Create `src/components/Layout/Layout.tsx`:

```tsx
import { Outlet, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { KeyboardProvider, useKeyboardScope } from '../../keyboard/KeyboardProvider'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { Header } from './Header'
import type { Binding } from '../../keyboard/types'
import './Layout.css'

/** Global navigation chords, registered once beneath the provider. */
function GlobalScope() {
  const navigate = useNavigate()
  const bindings = useMemo<Binding[]>(
    () => [
      { keys: 'g h', label: 'home', action: () => navigate('/') },
      { keys: 'g p', label: 'projects', action: () => navigate('/projects') },
      { keys: 'g w', label: 'writing', action: () => navigate('/writing') },
      { keys: 'g a', label: 'about', action: () => navigate('/about') },
    ],
    [navigate],
  )
  useKeyboardScope({ id: 'global', bindings })
  return null
}

export function Layout() {
  const isDesktop = useIsDesktop()
  return (
    <KeyboardProvider enabled={isDesktop}>
      <GlobalScope />
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" className="layout__main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="layout__footer">
        <span>© {new Date().getFullYear()} Michael Shafir</span>
        <a href="https://github.com/mshafir">github.com/mshafir</a>
      </footer>
    </KeyboardProvider>
  )
}
```

Create `src/components/Layout/Layout.css`:

```css
.layout__main { min-height: 60vh; outline: none; }

.layout__footer {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-8) var(--space-6);
  margin-top: var(--space-16);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--dim);
}

@media (min-width: 768px) {
  /* Leave room for the fixed shortcut bar. */
  .layout__footer { margin-bottom: var(--shortcut-bar-height); }
}
```

- [ ] **Step 8: Create placeholder pages**

These are intentionally thin — Task 11 fills them in.

`src/pages/Home.tsx`:

```tsx
import { Seo } from '../components/Seo'

export default function Home() {
  return (
    <>
      <Seo title="Home" description="Michael Shafir — software architect writing about AI." path="/" />
      <h1>Michael Shafir</h1>
    </>
  )
}
```

`src/pages/Projects.tsx`:

```tsx
import { Seo } from '../components/Seo'

export default function Projects() {
  return (
    <>
      <Seo title="Projects" description="Open source projects by Michael Shafir." path="/projects" />
      <h1>Projects</h1>
    </>
  )
}
```

`src/pages/Writing.tsx`:

```tsx
import { Seo } from '../components/Seo'
import { allPosts } from '../content/posts'

export default function Writing() {
  return (
    <>
      <Seo title="Writing" description="Essays on AI, architecture and building software." path="/writing" />
      <h1>Writing</h1>
      <ul>{allPosts.map((post) => <li key={post.slug}>{post.frontmatter.title}</li>)}</ul>
    </>
  )
}
```

`src/pages/NotFound.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'

export default function NotFound() {
  return (
    <div style={{ padding: 'var(--space-16) var(--space-6)' }}>
      <Seo title="Not found" description="That page does not exist." path="/404" />
      <h1>404</h1>
      <p>No route matches that path.</p>
      <Link to="/">Back home</Link>
    </div>
  )
}
```

`src/pages/Post.tsx`:

```tsx
import { useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { getPost } from '../content/posts'
import NotFound from './NotFound'

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined
  if (!post) return <NotFound />
  return (
    <>
      <Seo
        title={post.frontmatter.title}
        description={post.frontmatter.description}
        path={`/writing/${post.slug}`}
        type="article"
      />
      <h1>{post.frontmatter.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </>
  )
}
```

`src/pages/About.tsx`:

```tsx
import { Seo } from '../components/Seo'

export default function About() {
  return (
    <>
      <Seo title="About" description="About Michael Shafir, software architect." path="/about" />
      <h1>About</h1>
    </>
  )
}
```

- [ ] **Step 9: Create the route table and SSG entry**

Create `src/routes.tsx`:

```tsx
import type { RouteRecord } from 'vite-react-ssg'
import { Layout } from './components/Layout/Layout'
import { postSlugs } from './content/posts'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Writing from './pages/Writing'
import Post from './pages/Post'
import About from './pages/About'
import NotFound from './pages/NotFound'

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects', element: <Projects /> },
      { path: 'writing', element: <Writing /> },
      {
        path: 'writing/:slug',
        element: <Post />,
        // Tells the SSG crawler which concrete paths to prerender.
        getStaticPaths: () => postSlugs.map((slug) => `/writing/${slug}`),
      },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
```

Create `src/main.tsx`:

```tsx
import { ViteReactSSG } from 'vite-react-ssg'
import { routes } from './routes'
import './styles/base.css'

export const createRoot = ViteReactSSG({ routes })
```

- [ ] **Step 10: Update `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0B0E13" />
    <title>Michael Shafir — Software Architect</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 11: Verify the static build**

Run: `npm run build`, then:

```bash
find dist -name '*.html' | sort
grep -c 'Hello World' dist/writing/hello-world/index.html
```

Expected: `dist/index.html`, `dist/projects/index.html`, `dist/writing/index.html`,
`dist/writing/hello-world/index.html`, `dist/about/index.html`. The grep returns at
least 1 — proof the post content is in the static HTML, not only the bundle.

If `RouteRecord` or `Head` do not resolve as written, read the installed
package's own `.d.ts` and adapt the import names. The routing *shape* — one
layout route, a child per page, `getStaticPaths` for posts — is what matters.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: app shell, routing, and static prerendering of all routes"
```

---

### Task 8: Shortcut bar, command palette, help overlay

**Files:**
- Create: `src/components/ShortcutBar/ShortcutBar.tsx`, `ShortcutBar.css`
- Create: `src/components/CommandPalette/CommandPalette.tsx`, `CommandPalette.css`
- Create: `src/components/CommandPalette/fuzzy.ts`, `fuzzy.test.ts`
- Create: `src/components/HelpOverlay/HelpOverlay.tsx`, `HelpOverlay.css`
- Modify: `src/components/Layout/Layout.tsx`

**Interfaces:**
- Consumes: `useActiveBindings`, `usePendingChord`, `useKeyboardScope` (Task 5); `allPosts` (Task 4); `projects.json` and `Project` (Task 3).
- Produces: `fuzzyScore(query: string, target: string): number | null` — `null` when the query's characters do not appear in order, higher is better, `0` for an empty query. `<ShortcutBar />`, `<CommandPalette open onClose />`, `<HelpOverlay open onClose />`.

- [ ] **Step 1: Write the failing test for fuzzy matching**

Create `src/components/CommandPalette/fuzzy.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { fuzzyScore } from './fuzzy'

describe('fuzzyScore', () => {
  it('matches an exact substring', () => {
    expect(fuzzyScore('react', 'reactlit')).not.toBeNull()
  })

  it('matches characters in order with gaps', () => {
    expect(fuzzyScore('rlt', 'reactlit')).not.toBeNull()
  })

  it('rejects characters out of order', () => {
    expect(fuzzyScore('tiler', 'reactlit')).toBeNull()
  })

  it('rejects characters that are absent', () => {
    expect(fuzzyScore('zzz', 'reactlit')).toBeNull()
  })

  it('is case insensitive', () => {
    expect(fuzzyScore('REACT', 'reactlit')).not.toBeNull()
  })

  it('scores a contiguous prefix above a scattered match', () => {
    expect(fuzzyScore('rea', 'reactlit')!).toBeGreaterThan(fuzzyScore('rea', 'rendered-area')!)
  })

  it('treats an empty query as a neutral match', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/CommandPalette/fuzzy.test.ts`
Expected: FAIL — cannot resolve `./fuzzy`.

- [ ] **Step 3: Implement fuzzy matching**

Create `src/components/CommandPalette/fuzzy.ts`:

```ts
/**
 * Subsequence match with a contiguity bonus. Returns null when the query's
 * characters do not appear in `target` in order; otherwise a score where
 * higher is better.
 */
export function fuzzyScore(query: string, target: string): number | null {
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (q.length === 0) return 0

  let score = 0
  let targetIndex = 0
  let previousMatch = -2

  for (const char of q) {
    const found = t.indexOf(char, targetIndex)
    if (found === -1) return null
    // Reward adjacency, and reward matching near the start of the target.
    if (found === previousMatch + 1) score += 8
    if (found === 0) score += 6
    score += Math.max(0, 4 - found * 0.1)
    previousMatch = found
    targetIndex = found + 1
  }

  return score
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/CommandPalette/fuzzy.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Build the shortcut bar**

Create `src/components/ShortcutBar/ShortcutBar.tsx`:

```tsx
import { useActiveBindings, usePendingChord } from '../../keyboard/KeyboardProvider'
import './ShortcutBar.css'

const MAX_VISIBLE = 8

const display = (token: string) =>
  token.replace('mod+', '⌘').replace('Enter', '↵').replace('Escape', 'esc')

export function ShortcutBar() {
  const bindings = useActiveBindings()
  const pending = usePendingChord()

  return (
    <div className="shortcut-bar" role="status" aria-live="off">
      <ul className="shortcut-bar__list">
        {bindings.slice(0, MAX_VISIBLE).map((binding) => (
          <li key={binding.keys} className="shortcut-bar__item">
            {binding.keys.split(' ').map((token, i) => (
              <kbd className="shortcut-bar__key" key={`${binding.keys}-${i}`}>{display(token)}</kbd>
            ))}
            <span className="shortcut-bar__label">{binding.label}</span>
          </li>
        ))}
      </ul>
      {pending.length > 0 && <span className="shortcut-bar__pending">{pending.join(' ')}…</span>}
    </div>
  )
}
```

Create `src/components/ShortcutBar/ShortcutBar.css`:

```css
.shortcut-bar {
  position: fixed;
  inset: auto 0 0 0;
  height: var(--shortcut-bar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 0 var(--space-6);
  background: color-mix(in srgb, var(--bg-raised) 92%, transparent);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--dim);
  z-index: 30;
}

.shortcut-bar__list {
  display: flex;
  gap: var(--space-4);
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

.shortcut-bar__item { display: inline-flex; align-items: center; gap: var(--space-1); white-space: nowrap; }

.shortcut-bar__key {
  font-family: inherit;
  font-size: 0.6875rem;
  color: var(--accent);
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 3px;
  padding: 1px var(--space-1);
  min-width: 1.25rem;
  text-align: center;
  background: var(--bg);
}

.shortcut-bar__label { margin-left: var(--space-1); }
.shortcut-bar__pending { color: var(--accent); white-space: nowrap; }

/* A desktop affordance only. */
@media (max-width: 767px) { .shortcut-bar { display: none; } }
```

- [ ] **Step 6: Build the help overlay**

Create `src/components/HelpOverlay/HelpOverlay.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { useActiveBindings } from '../../keyboard/KeyboardProvider'
import './HelpOverlay.css'

export function HelpOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const bindings = useActiveBindings()
  const closeRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="overlay__panel"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="overlay__head">
          <h2 className="overlay__title">Keyboard shortcuts</h2>
          <button ref={closeRef} className="overlay__close" onClick={onClose}>esc</button>
        </div>
        <dl className="overlay__list">
          {bindings.map((binding) => (
            <div className="overlay__row" key={binding.keys}>
              <dt>
                {binding.keys.split(' ').map((token, i) => (
                  <kbd className="overlay__key" key={i}>
                    {token.replace('mod+', '⌘').replace('Enter', '↵')}
                  </kbd>
                ))}
              </dt>
              <dd>{binding.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
```

Create `src/components/HelpOverlay/HelpOverlay.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: var(--space-6);
  z-index: 50;
}

.overlay__panel {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: min(34rem, 100%);
  max-height: 80vh;
  overflow: auto;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.overlay__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border);
}

.overlay__title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dim);
}

.overlay__close {
  font: inherit;
  color: var(--dim);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 2px var(--space-2);
  cursor: pointer;
}

.overlay__list { margin: 0; padding: var(--space-2) var(--space-4) var(--space-4); }

.overlay__row {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.overlay__row dd { margin: 0; color: var(--dim); }

.overlay__key {
  font-family: inherit;
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px var(--space-1);
  margin-right: var(--space-1);
  background: var(--bg);
}
```

- [ ] **Step 7: Build the command palette**

Create `src/components/CommandPalette/CommandPalette.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { allPosts } from '../../content/posts'
import projectData from '../../data/projects.json'
import type { Project } from '../../data/types'
import { fuzzyScore } from './fuzzy'
import './CommandPalette.css'

const projects = projectData as Project[]

interface Command {
  id: string
  label: string
  hint: string
  run: () => void
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => { navigate(path); onClose() }
    return [
      { id: 'nav-home', label: 'Home', hint: 'page', run: go('/') },
      { id: 'nav-projects', label: 'Projects', hint: 'page', run: go('/projects') },
      { id: 'nav-writing', label: 'Writing', hint: 'page', run: go('/writing') },
      { id: 'nav-about', label: 'About', hint: 'page', run: go('/about') },
      ...allPosts.map((post) => ({
        id: `post-${post.slug}`,
        label: post.frontmatter.title,
        hint: 'post',
        run: go(`/writing/${post.slug}`),
      })),
      ...projects.map((project) => ({
        id: `repo-${project.name}`,
        label: project.name,
        hint: 'repo',
        run: () => { window.open(project.url, '_blank', 'noopener'); onClose() },
      })),
    ]
  }, [navigate, onClose])

  const results = useMemo(
    () =>
      commands
        .map((command) => ({ command, score: fuzzyScore(query, command.label) }))
        .filter((entry): entry is { command: Command; score: number } => entry.score !== null)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((entry) => entry.command),
    [commands, query],
  )

  useEffect(() => { setIndex(0) }, [query])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    setQuery('')
    inputRef.current?.focus()
    return () => previousFocus.current?.focus()
  }, [open])

  if (!open) return null

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === 'ArrowDown' || (event.key === 'n' && event.ctrlKey)) {
      event.preventDefault()
      setIndex((i) => (i + 1) % Math.max(1, results.length))
    } else if (event.key === 'ArrowUp' || (event.key === 'p' && event.ctrlKey)) {
      event.preventDefault()
      setIndex((i) => (i - 1 + results.length) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      results[index]?.run()
    }
  }

  return (
    <div className="overlay overlay--top" onClick={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="palette__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a page, post, or repo…"
          aria-label="Search"
          aria-controls="palette-results"
        />
        <ul className="palette__results" id="palette-results" role="listbox">
          {results.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                className={i === index ? 'palette__item palette__item--active' : 'palette__item'}
                onMouseEnter={() => setIndex(i)}
                onClick={command.run}
              >
                <span>{command.label}</span>
                <span className="palette__hint">{command.hint}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="palette__empty">No matches</li>}
        </ul>
      </div>
    </div>
  )
}
```

Create `src/components/CommandPalette/CommandPalette.css`:

```css
.overlay--top { align-items: start; padding-top: 12vh; }

.palette {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: min(34rem, 100%);
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: 0.875rem;
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.5);
}

.palette__input {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  font: inherit;
  padding: var(--space-4);
  outline: none;
}

.palette__input::placeholder { color: var(--dim); }

.palette__results {
  list-style: none;
  margin: 0;
  padding: var(--space-2);
  max-height: 22rem;
  overflow: auto;
}

.palette__item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  font: inherit;
  color: var(--text);
  background: transparent;
  border: 0;
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  text-align: left;
}

.palette__item--active {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.palette__hint { color: var(--dim); font-size: 0.75rem; }
.palette__empty { color: var(--dim); padding: var(--space-3); }
```

- [ ] **Step 8: Wire the overlays into the layout**

Replace `src/components/Layout/Layout.tsx` entirely:

```tsx
import { Outlet, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'
import { KeyboardProvider, useKeyboardScope } from '../../keyboard/KeyboardProvider'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { ShortcutBar } from '../ShortcutBar/ShortcutBar'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { HelpOverlay } from '../HelpOverlay/HelpOverlay'
import { Header } from './Header'
import type { Binding } from '../../keyboard/types'
import './Layout.css'

type Overlay = 'none' | 'palette' | 'help'

function GlobalScope({ setOverlay }: { setOverlay: (overlay: Overlay) => void }) {
  const navigate = useNavigate()
  const bindings = useMemo<Binding[]>(
    () => [
      { keys: 'g h', label: 'home', action: () => navigate('/') },
      { keys: 'g p', label: 'projects', action: () => navigate('/projects') },
      { keys: 'g w', label: 'writing', action: () => navigate('/writing') },
      { keys: 'g a', label: 'about', action: () => navigate('/about') },
      { keys: '/', label: 'search', action: () => setOverlay('palette') },
      { keys: 'mod+k', label: 'search', hidden: true, action: () => setOverlay('palette') },
      { keys: '?', label: 'help', action: () => setOverlay('help') },
    ],
    [navigate, setOverlay],
  )
  useKeyboardScope({ id: 'global', bindings })
  return null
}

/** Pushed while an overlay is open: Escape closes and nothing else leaks. */
function OverlayScope({ onClose }: { onClose: () => void }) {
  const bindings = useMemo<Binding[]>(
    () => [{ keys: 'Escape', label: 'close', action: onClose, allowInInput: true }],
    [onClose],
  )
  useKeyboardScope({ id: 'overlay', bindings })
  return null
}

export function Layout() {
  const isDesktop = useIsDesktop()
  const [overlay, setOverlay] = useState<Overlay>('none')
  const close = useCallback(() => setOverlay('none'), [])

  return (
    <KeyboardProvider enabled={isDesktop}>
      <GlobalScope setOverlay={setOverlay} />
      {overlay !== 'none' && <OverlayScope onClose={close} />}
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <main id="main" className="layout__main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="layout__footer">
        <span>© {new Date().getFullYear()} Michael Shafir</span>
        <a href="https://github.com/mshafir">github.com/mshafir</a>
      </footer>
      {isDesktop && (
        <>
          <ShortcutBar />
          <CommandPalette open={overlay === 'palette'} onClose={close} />
          <HelpOverlay open={overlay === 'help'} onClose={close} />
        </>
      )}
    </KeyboardProvider>
  )
}
```

- [ ] **Step 9: Verify the suite and the build**

Run: `npm test && npm run build`
Expected: all tests PASS; the build emits the same five HTML files as Task 7.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: shortcut bar, command palette, and help overlay"
```

---

### Task 9: Voxel portrait hero

**Files:**
- Create: `src/components/VoxelPortrait/VoxelPortrait.tsx`
- Create: `src/components/VoxelPortrait/VoxelScene.tsx`
- Create: `src/components/VoxelPortrait/VoxelFallback.tsx`
- Create: `src/components/VoxelPortrait/hasWebGL.ts`
- Create: `src/components/VoxelPortrait/VoxelPortrait.css`
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes: `src/data/voxels.json` and `VoxelData` (Tasks 2 and 3), `usePrefersReducedMotion` (Task 7).
- Produces: `<VoxelPortrait />` — self-contained, sized by its CSS container, safe during prerender (emits only a placeholder shell server-side).

- [ ] **Step 1: Write the WebGL capability check**

Create `src/components/VoxelPortrait/hasWebGL.ts`:

```ts
export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Write the 2D fallback**

Create `src/components/VoxelPortrait/VoxelFallback.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

/**
 * Flat painted version of the same voxel grid for browsers without WebGL.
 * Depth becomes brightness rather than geometry.
 */
export function VoxelFallback() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const size = data.size
    const cell = Math.floor(canvas.width / size)
    const half = size / 2
    const maxZ = Math.max(...data.voxels.map((v) => v[2]), 1)

    context.clearRect(0, 0, canvas.width, canvas.height)
    for (const [x, y, z, r, g, b] of data.voxels) {
      // Nearer voxels read brighter, which reads as depth on a flat surface.
      const shade = 0.55 + 0.45 * (z / maxZ)
      context.fillStyle = `rgb(${r * shade} ${g * shade} ${b * shade})`
      context.fillRect((x + half) * cell, (half - y) * cell, cell, cell)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={512}
      height={512}
      className="voxel__fallback"
      role="img"
      aria-label="Voxel portrait of Michael Shafir"
    />
  )
}
```

- [ ] **Step 3: Write the three.js scene**

Create `src/components/VoxelPortrait/VoxelScene.tsx`:

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, Object3D, Vector3, type InstancedMesh } from 'three'
import voxelData from '../../data/voxels.json'
import type { VoxelData } from '../../data/types'

const data = voxelData as VoxelData

const MAX_YAW = MathUtils.degToRad(14)
const MAX_PITCH = MathUtils.degToRad(8)
const ASSEMBLE_SECONDS = 1.2
const SCATTER_RADIUS = 60

function VoxelCloud({ animate }: { animate: boolean }) {
  const meshRef = useRef<InstancedMesh>(null)
  const dummy = useMemo(() => new Object3D(), [])
  const pointer = useRef({ x: 0, y: 0 })
  const elapsed = useRef(0)
  const { size } = useThree()

  // Per-voxel destinations, scatter origins, stagger delays and colors, once.
  const layout = useMemo(() => {
    const half = data.size / 2
    const ys = data.voxels.map((v) => v[1])
    const minY = Math.min(...ys)
    const span = Math.max(1, Math.max(...ys) - minY)

    return data.voxels.map(([x, y, z, r, g, b]) => ({
      target: new Vector3(x, y, z - half * 0.35),
      origin: new Vector3(
        x + (Math.random() - 0.5) * SCATTER_RADIUS,
        y + (Math.random() - 0.5) * SCATTER_RADIUS,
        z + (Math.random() - 0.5) * SCATTER_RADIUS,
      ),
      // Bottom voxels land first, so the portrait builds upward.
      delay: ((y - minY) / span) * 0.45,
      color: new Color(r / 255, g / 255, b / 255),
    }))
  }, [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    layout.forEach((voxel, i) => mesh.setColorAt(i, voxel.color))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [layout])

  useEffect(() => {
    if (!animate) return
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('pointermove', onPointerMove)
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [animate])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    elapsed.current += delta
    const t = animate ? Math.min(1, elapsed.current / ASSEMBLE_SECONDS) : 1

    // Assemble the cloud, easing each voxel in after its own stagger delay.
    if (elapsed.current <= ASSEMBLE_SECONDS + delta) {
      layout.forEach((voxel, i) => {
        const local = MathUtils.clamp((t - voxel.delay) / (1 - voxel.delay || 1), 0, 1)
        const eased = 1 - Math.pow(1 - local, 3)
        dummy.position.lerpVectors(voxel.origin, voxel.target, eased)
        dummy.scale.setScalar(0.9 * eased)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    if (!animate) {
      mesh.rotation.set(0, 0, 0)
      return
    }

    // Touch devices have no cursor, so drift on a slow sine instead.
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    const targetYaw = isCoarse
      ? Math.sin(elapsed.current * 0.4) * MAX_YAW
      : pointer.current.x * MAX_YAW + Math.sin(elapsed.current * 0.3) * 0.02
    const targetPitch = isCoarse
      ? Math.sin(elapsed.current * 0.25) * MAX_PITCH * 0.5
      : pointer.current.y * MAX_PITCH + Math.cos(elapsed.current * 0.22) * 0.015

    // Damped follow: the head eases toward the cursor and never snaps.
    mesh.rotation.y = MathUtils.damp(mesh.rotation.y, targetYaw, 3, delta)
    mesh.rotation.x = MathUtils.damp(mesh.rotation.x, targetPitch, 3, delta)
  })

  return (
    <group scale={size.width < 768 ? 0.75 : 1}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, layout.length]}>
        <boxGeometry args={[0.92, 0.92, 0.92]} />
        <meshStandardMaterial roughness={0.62} metalness={0.08} />
      </instancedMesh>
    </group>
  )
}

export default function VoxelScene({ animate }: { animate: boolean }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 92], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[30, 40, 60]} intensity={2.1} />
      {/* Cyan rim light lifts the silhouette off the near-black ground. */}
      <directionalLight position={[-50, 10, -30]} intensity={1.6} color="#22D3EE" />
      <VoxelCloud animate={animate} />
    </Canvas>
  )
}
```

- [ ] **Step 4: Write the client-only wrapper**

Create `src/components/VoxelPortrait/VoxelPortrait.tsx`:

```tsx
import { Suspense, lazy, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { VoxelFallback } from './VoxelFallback'
import { hasWebGL } from './hasWebGL'
import './VoxelPortrait.css'

// Kept out of the prerender pass and off the critical path: three.js is large
// and touches window during module evaluation.
const VoxelScene = lazy(() => import('./VoxelScene'))

export function VoxelPortrait() {
  const [mounted, setMounted] = useState(false)
  const [webgl, setWebgl] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    setWebgl(hasWebGL())
    setMounted(true)
  }, [])

  return (
    <div className="voxel" role="img" aria-label="Voxel portrait of Michael Shafir">
      {!mounted && <div className="voxel__placeholder" aria-hidden="true" />}
      {mounted && !webgl && <VoxelFallback />}
      {mounted && webgl && (
        <Suspense fallback={<div className="voxel__placeholder" aria-hidden="true" />}>
          <VoxelScene animate={!reducedMotion} />
        </Suspense>
      )}
    </div>
  )
}
```

Create `src/components/VoxelPortrait/VoxelPortrait.css`:

```css
.voxel {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  max-width: 30rem;
  margin-inline: auto;
}

.voxel canvas { display: block; width: 100% !important; height: 100% !important; }

.voxel__placeholder {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  background: radial-gradient(
    circle at 50% 42%,
    color-mix(in srgb, var(--accent) 8%, transparent),
    transparent 62%
  );
}

.voxel__fallback { width: 100%; height: auto; image-rendering: pixelated; }
```

- [ ] **Step 5: Render it and check it visually**

Modify `src/pages/Home.tsx` to import `VoxelPortrait` and render it beneath the `h1`.

Run: `npm run dev` and open the printed URL.
Expected: the portrait assembles from scattered cubes over about a second, then
tracks the cursor with damped rotation. If it reads as noise rather than a face,
adjust `domeDepth` / `reliefDepth` in `scripts/lib/voxelize.mjs` and re-run
`npm run data:voxels`.

- [ ] **Step 6: Verify the build still prerenders**

Run: `npm run build`
Expected: no "window is not defined" error; `dist/index.html` exists and contains
`voxel__placeholder`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: cursor-reactive voxel portrait with 2d and reduced-motion fallbacks"
```

---
### Task 10: Matrix project tiles

**Files:**
- Create: `src/components/ProjectTile/useMatrixTicker.ts`
- Create: `src/components/ProjectTile/MatrixRain.tsx`
- Create: `src/components/ProjectTile/ProjectTile.tsx`
- Create: `src/components/ProjectTile/ProjectGrid.tsx`
- Create: `src/components/ProjectTile/ProjectTile.css`
- Create: `src/components/ProjectTile/ProjectTile.test.tsx`

**Interfaces:**
- Consumes: `Project` (Task 3), `useRovingFocus` (Task 6), `usePrefersReducedMotion` (Task 7).
- Produces: `useMatrixTicker(callback: (deltaMs: number) => void, active: boolean): void` — one shared rAF loop for the whole page, throttled to `TICK_MS = 55`. `<ProjectGrid id projects />` renders a roving-focus list of `<ProjectTile>` anchors.

- [ ] **Step 1: Write the failing test**

Create `src/components/ProjectTile/ProjectTile.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { KeyboardProvider } from '../../keyboard/KeyboardProvider'
import { ProjectGrid } from './ProjectGrid'
import type { Project } from '../../data/types'

const projects: Project[] = [
  { name: 'reactlit', url: 'https://github.com/mshafir/reactlit', blurb: 'Faster React apps.', language: 'TypeScript', stars: 12, pushedAt: '2025-04-25T00:00:00Z', featured: true },
  { name: 'vislib', url: 'https://github.com/mshafir/vislib', blurb: '', language: null, stars: 3, pushedAt: '2018-06-07T00:00:00Z', featured: false },
]

const setup = () =>
  render(
    <MemoryRouter>
      <KeyboardProvider>
        <ProjectGrid id="test-grid" projects={projects} />
      </KeyboardProvider>
    </MemoryRouter>,
  )

describe('ProjectGrid', () => {
  it('renders one link per project, pointing at the repo', () => {
    setup()
    expect(screen.getByRole('link', { name: /reactlit/ }))
      .toHaveAttribute('href', 'https://github.com/mshafir/reactlit')
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })

  it('shows the blurb, language, and star count', () => {
    setup()
    expect(screen.getByText('Faster React apps.')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('omits the language chip when a repo has no language', () => {
    setup()
    expect(screen.getByRole('link', { name: /vislib/ }).textContent).not.toContain('null')
  })

  it('hides the decorative rain canvas from assistive tech', () => {
    const { container } = setup()
    const canvases = container.querySelectorAll('canvas')
    expect(canvases).toHaveLength(2)
    canvases.forEach((canvas) => expect(canvas).toHaveAttribute('aria-hidden', 'true'))
  })

  it('marks external links safe', () => {
    setup()
    screen.getAllByRole('link').forEach((link) => {
      expect(link.getAttribute('rel')).toContain('noopener')
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ProjectTile/ProjectTile.test.tsx`
Expected: FAIL — cannot resolve `./ProjectGrid`.

- [ ] **Step 3: Implement the shared ticker**

Create `src/components/ProjectTile/useMatrixTicker.ts`:

```ts
import { useEffect } from 'react'

/**
 * One requestAnimationFrame loop for every rain canvas on the page, throttled
 * to ~18fps. The low framerate is the intended look and keeps a grid of tiles
 * cheap. The loop stops entirely when nothing is subscribed or the tab hides.
 */
const TICK_MS = 55

type Subscriber = (deltaMs: number) => void

const subscribers = new Set<Subscriber>()
let frame: number | null = null
let lastTime = 0
let accumulator = 0

function loop(time: number) {
  frame = requestAnimationFrame(loop)
  const delta = lastTime === 0 ? 0 : time - lastTime
  lastTime = time
  accumulator += delta
  if (accumulator < TICK_MS) return
  const step = accumulator
  accumulator = 0
  subscribers.forEach((subscriber) => subscriber(step))
}

function start() {
  if (frame !== null || typeof window === 'undefined') return
  lastTime = 0
  accumulator = 0
  frame = requestAnimationFrame(loop)
}

function stop() {
  if (frame === null) return
  cancelAnimationFrame(frame)
  frame = null
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop()
    else if (subscribers.size > 0) start()
  })
}

export function useMatrixTicker(callback: Subscriber, active: boolean): void {
  useEffect(() => {
    if (!active) return
    subscribers.add(callback)
    start()
    return () => {
      subscribers.delete(callback)
      if (subscribers.size === 0) stop()
    }
  }, [callback, active])
}
```

- [ ] **Step 4: Implement the rain canvas**

Create `src/components/ProjectTile/MatrixRain.tsx`:

```tsx
import { useCallback, useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery'
import { useMatrixTicker } from './useMatrixTicker'

const GLYPHS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789<>/{}[]=;:$#@&*'
const CELL = 14
const REST_COLOR = '#2A3340'
const ACTIVE_COLOR = '#22D3EE'

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]

export function MatrixRain({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dropsRef = useRef<number[]>([])
  const activeRef = useRef(active)
  const visibleRef = useRef(false)
  const reducedMotion = usePrefersReducedMotion()

  activeRef.current = active

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0)
    const columns = Math.max(1, Math.floor(rect.width / CELL))
    dropsRef.current = Array.from({ length: columns }, () =>
      Math.floor((Math.random() * rect.height) / CELL),
    )
  }, [])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const width = canvas.clientWidth
    const height = canvas.clientHeight

    // A translucent wipe rather than a clear, so trailing glyphs fade out.
    context.fillStyle = 'rgba(11, 14, 19, 0.16)'
    context.fillRect(0, 0, width, height)
    context.font = `${CELL - 2}px ui-monospace, monospace`
    context.fillStyle = activeRef.current ? ACTIVE_COLOR : REST_COLOR

    const drops = dropsRef.current
    const speed = activeRef.current ? 1 : 0.45

    for (let i = 0; i < drops.length; i++) {
      context.fillText(randomGlyph(), i * CELL, drops[i] * CELL)
      drops[i] += speed
      if (drops[i] * CELL > height && Math.random() > 0.975) drops[i] = 0
    }
  }, [])

  const tick = useCallback(() => {
    if (visibleRef.current) paint()
  }, [paint])

  useMatrixTicker(tick, !reducedMotion)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    resize()

    // A static field for reduced motion: the texture without the movement.
    if (reducedMotion) {
      paint()
      paint()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => { visibleRef.current = entry.isIntersecting },
      { rootMargin: '80px' },
    )
    observer.observe(canvas)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [resize, paint, reducedMotion])

  return <canvas ref={canvasRef} className="tile__rain" aria-hidden="true" />
}
```

- [ ] **Step 5: Implement the tile and grid**

Create `src/components/ProjectTile/ProjectTile.tsx`:

```tsx
import { forwardRef, useState } from 'react'
import type { Project } from '../../data/types'
import { MatrixRain } from './MatrixRain'
import './ProjectTile.css'

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178C6',
  JavaScript: '#F1E05A',
  Python: '#3572A5',
  HTML: '#E34C26',
  CSS: '#563D7C',
  Java: '#B07219',
  Go: '#00ADD8',
  Rust: '#DEA584',
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

export const ProjectTile = forwardRef<HTMLAnchorElement, { project: Project }>(
  function ProjectTile({ project }, ref) {
    const [active, setActive] = useState(false)

    return (
      <a
        ref={ref}
        className="tile"
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        // Keyboard focus drives the same intensity change as hover, so
        // keyboard users get identical feedback.
        onFocus={() => setActive(true)}
        onBlur={() => setActive(false)}
      >
        <MatrixRain active={active} />
        <div className="tile__body">
          <h3 className="tile__name">{project.name}</h3>
          {project.blurb && <p className="tile__blurb">{project.blurb}</p>}
          <div className="tile__meta">
            {project.language && (
              <span className="tile__chip">
                <span
                  className="tile__dot"
                  style={{ background: LANGUAGE_COLORS[project.language] ?? 'var(--dim)' }}
                />
                {project.language}
              </span>
            )}
            <span className="tile__chip" title={`${project.stars} stars`}>
              <span aria-hidden="true">★</span>
              {project.stars}
            </span>
            <span className="tile__chip tile__chip--date">{formatDate(project.pushedAt)}</span>
          </div>
        </div>
      </a>
    )
  },
)
```

Create `src/components/ProjectTile/ProjectGrid.tsx`:

```tsx
import { useRovingFocus } from '../../keyboard/useRovingFocus'
import type { Project } from '../../data/types'
import { ProjectTile } from './ProjectTile'

export function ProjectGrid({ id, projects }: { id: string; projects: Project[] }) {
  const { itemRef } = useRovingFocus({ id, count: projects.length, label: 'project' })

  return (
    <div className="tile-grid">
      {projects.map((project, index) => (
        <ProjectTile key={project.name} project={project} ref={itemRef(index)} />
      ))}
    </div>
  )
}
```

Create `src/components/ProjectTile/ProjectTile.css`:

```css
.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: var(--space-4);
}

.tile {
  position: relative;
  display: block;
  min-height: 11rem;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: var(--bg-raised);
  text-decoration: none;
  color: inherit;
  transition: border-color 160ms ease, transform 160ms ease;
}

.tile:hover, .tile:focus-visible { border-color: var(--accent); transform: translateY(-2px); }

.tile__rain {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.5;
  pointer-events: none;
}

.tile:hover .tile__rain, .tile:focus-visible .tile__rain { opacity: 0.75; }

.tile__body {
  position: relative;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  height: 100%;
  /* Sits above the rain and keeps the type readable against it. */
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--bg-raised) 78%, transparent),
    color-mix(in srgb, var(--bg-raised) 94%, transparent)
  );
}

.tile__name {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.9375rem;
  letter-spacing: 0.01em;
}

.tile:hover .tile__name, .tile:focus-visible .tile__name { color: var(--accent); }

.tile__blurb {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--dim);
  flex: 1;
}

.tile__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--dim);
  margin-top: auto;
}

.tile__chip { display: inline-flex; align-items: center; gap: var(--space-1); }
.tile__dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.tile__chip--date { margin-left: auto; }

@media (max-width: 767px) { .tile-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/components/ProjectTile/ProjectTile.test.tsx`
Expected: PASS, 5 tests. jsdom returns `null` from `getContext('2d')`, which the
guards in `MatrixRain` handle — the canvas element still renders.

- [ ] **Step 7: Commit**

```bash
git add src/components/ProjectTile
git commit -m "feat: matrix rain project tiles on a shared throttled ticker"
```

---

### Task 11: Page content and prose styles

**Files:**
- Modify: `src/pages/Home.tsx`, `Projects.tsx`, `Writing.tsx`, `Post.tsx`, `About.tsx`
- Create: `src/pages/pages.css`
- Replace: `src/styles/prose.css` (the stub from Task 1)
- Create: `src/components/PostList/PostList.tsx`

**Interfaces:**
- Consumes: `<VoxelPortrait />` (Task 9), `<ProjectGrid />` (Task 10), `useRovingFocus` (Task 6), `allPosts`/`getPost`/`getAdjacentPosts` (Task 4), `projects.json` (Task 3).
- Produces: `<PostList id posts />` — a roving-focus list of internal post links.

- [ ] **Step 1: Create the shared page styles**

Create `src/pages/pages.css`:

```css
.page { max-width: 64rem; margin: 0 auto; padding: var(--space-12) var(--space-6) 0; }

.page__title {
  font-family: var(--font-mono);
  font-size: 1.25rem;
  letter-spacing: 0.02em;
  margin: 0 0 var(--space-2);
}

.page__lede { color: var(--dim); max-width: var(--measure); margin: 0 0 var(--space-8); }

.section { margin-block: var(--space-12); }

.section__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--border);
}

.section__title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dim);
  margin: 0;
}

.section__link { font-family: var(--font-mono); font-size: 0.75rem; color: var(--dim); text-decoration: none; }
.section__link:hover { color: var(--accent); }

/* --- Hero --- */

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-12);
  padding-block: var(--space-8) var(--space-12);
}

.hero__name {
  font-size: clamp(2.25rem, 6vw, 3.75rem);
  line-height: 1.05;
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-4);
}

.hero__role {
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 var(--space-6);
}

.hero__blurb { max-width: 36ch; color: var(--dim); font-size: 1.0625rem; margin: 0 0 var(--space-6); }

.hero__links { display: flex; gap: var(--space-4); font-family: var(--font-mono); font-size: 0.8125rem; }

.hero__link {
  color: var(--text);
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  padding-bottom: 2px;
}
.hero__link:hover { color: var(--accent); border-color: var(--accent); }

/* --- Post list --- */

.post-list { list-style: none; margin: 0; padding: 0; }

.post-list__link {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-3);
  border-radius: 4px;
  text-decoration: none;
  border-bottom: 1px solid var(--border);
  transition: background 140ms ease;
}

.post-list__link:hover, .post-list__link:focus-visible { background: var(--bg-raised); }

.post-list__date {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--dim);
  padding-top: 0.35rem;
}

.post-list__title { margin: 0 0 var(--space-1); font-size: 1.0625rem; }
.post-list__link:hover .post-list__title { color: var(--accent); }
.post-list__desc { margin: 0; color: var(--dim); font-size: 0.9375rem; max-width: var(--measure); }

.post-list__tags {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--dim);
}

.post-list__tag { border: 1px solid var(--border); border-radius: 3px; padding: 0 var(--space-1); }

/* --- Article --- */

.article { max-width: var(--measure); margin: 0 auto; padding: var(--space-12) var(--space-6) 0; }

.article__meta {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--dim);
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.article__title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  line-height: 1.15;
  margin: 0 0 var(--space-8);
  letter-spacing: -0.015em;
}

.article__toc {
  border-left: 2px solid var(--border);
  padding: var(--space-2) 0 var(--space-2) var(--space-4);
  margin-bottom: var(--space-8);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.article__toc ul { list-style: none; margin: 0; padding: 0; }
.article__toc a { color: var(--dim); text-decoration: none; display: block; padding: var(--space-1) 0; }
.article__toc a:hover { color: var(--accent); }
.article__toc li[data-depth='3'] { padding-left: var(--space-4); }

.article__nav {
  display: flex;
  justify-content: space-between;
  gap: var(--space-6);
  margin-top: var(--space-16);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.8125rem;
}

.article__nav a { color: var(--dim); text-decoration: none; }
.article__nav a:hover { color: var(--accent); }

@media (max-width: 767px) {
  .page, .article { padding-top: var(--space-8); }
  .hero { grid-template-columns: 1fr; gap: var(--space-8); padding-block: var(--space-4) var(--space-8); }
  /* Portrait leads on mobile. */
  .hero__portrait { order: -1; }
  .post-list__link { grid-template-columns: 1fr; gap: var(--space-1); }
  .post-list__date { padding-top: 0; }
}
```

- [ ] **Step 2: Replace the prose stylesheet**

Replace `src/styles/prose.css`:

```css
.prose { font-size: 1.0625rem; line-height: 1.75; }

.prose > * + * { margin-top: var(--space-6); }

.prose h2 {
  font-size: 1.25rem;
  letter-spacing: -0.01em;
  margin-top: var(--space-12);
  scroll-margin-top: 5rem;
}

.prose h3 {
  font-size: 1.0625rem;
  margin-top: var(--space-8);
  scroll-margin-top: 5rem;
  color: var(--dim);
}

.prose a {
  color: var(--accent);
  text-decoration-color: color-mix(in srgb, var(--accent) 40%, transparent);
  text-underline-offset: 3px;
}

.prose code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}

/* Shiki emits <pre class="shiki"><code>…; the inner code must stay bare. */
.prose pre {
  background: var(--bg-raised) !important;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: var(--space-4);
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.6;
}

.prose pre code { background: none; border: 0; padding: 0; font-size: inherit; }

.prose blockquote {
  border-left: 2px solid var(--accent);
  padding-left: var(--space-4);
  margin-left: 0;
  color: var(--dim);
  font-style: italic;
}

.prose ul, .prose ol { padding-left: var(--space-6); }
.prose li + li { margin-top: var(--space-2); }

.prose img { max-width: 100%; height: auto; border-radius: 4px; }

.prose hr { border: 0; border-top: 1px solid var(--border); margin-block: var(--space-12); }

.prose table { width: 100%; border-collapse: collapse; font-size: 0.9375rem; }
.prose th, .prose td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}
.prose th {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--dim);
}
```

- [ ] **Step 3: Build the post list component**

Create `src/components/PostList/PostList.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useRovingFocus } from '../../keyboard/useRovingFocus'
import type { Post } from '../../content/posts'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })

export function PostList({ id, posts }: { id: string; posts: Post[] }) {
  const { itemRef } = useRovingFocus({ id, count: posts.length, label: 'post' })

  if (posts.length === 0) return <p className="page__lede">No posts yet.</p>

  return (
    <ul className="post-list">
      {posts.map((post, index) => (
        <li key={post.slug}>
          <Link className="post-list__link" to={`/writing/${post.slug}`} ref={itemRef(index)}>
            <time className="post-list__date" dateTime={post.frontmatter.date}>
              {formatDate(post.frontmatter.date)}
            </time>
            <div>
              <h3 className="post-list__title">{post.frontmatter.title}</h3>
              {post.frontmatter.description && (
                <p className="post-list__desc">{post.frontmatter.description}</p>
              )}
              {post.frontmatter.tags.length > 0 && (
                <div className="post-list__tags">
                  {post.frontmatter.tags.map((tag) => (
                    <span className="post-list__tag" key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 4: Fill in the home page**

Replace `src/pages/Home.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { VoxelPortrait } from '../components/VoxelPortrait/VoxelPortrait'
import { ProjectGrid } from '../components/ProjectTile/ProjectGrid'
import { PostList } from '../components/PostList/PostList'
import { allPosts } from '../content/posts'
import projectData from '../data/projects.json'
import type { Project } from '../data/types'
import './pages.css'

const projects = projectData as Project[]

export default function Home() {
  const featured = projects.filter((project) => project.featured).slice(0, 6)
  const latest = allPosts.slice(0, 3)

  return (
    <div className="page">
      <Seo
        title="Home"
        description="Michael Shafir — software architect. Building with AI, writing about the systems underneath."
        path="/"
      />

      <section className="hero">
        <div>
          <p className="hero__role">Software Architect</p>
          <h1 className="hero__name">Michael Shafir</h1>
          <p className="hero__blurb">
            I design and build software systems, and I write about what happens
            when you put language models inside them.
          </p>
          <div className="hero__links">
            <a className="hero__link" href="https://github.com/mshafir">github</a>
            <Link className="hero__link" to="/writing">writing</Link>
            <Link className="hero__link" to="/about">about</Link>
          </div>
        </div>
        <div className="hero__portrait">
          <VoxelPortrait />
        </div>
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Selected projects</h2>
          <Link className="section__link" to="/projects">all projects →</Link>
        </div>
        <ProjectGrid id="home-projects" projects={featured} />
      </section>

      <section className="section">
        <div className="section__head">
          <h2 className="section__title">Latest writing</h2>
          <Link className="section__link" to="/writing">all posts →</Link>
        </div>
        <PostList id="home-posts" posts={latest} />
      </section>
    </div>
  )
}
```

- [ ] **Step 5: Fill in the projects page**

Replace `src/pages/Projects.tsx`:

```tsx
import { Seo } from '../components/Seo'
import { ProjectGrid } from '../components/ProjectTile/ProjectGrid'
import projectData from '../data/projects.json'
import type { Project } from '../data/types'
import './pages.css'

const projects = projectData as Project[]

export default function Projects() {
  return (
    <div className="page">
      <Seo
        title="Projects"
        description="Open source projects by Michael Shafir — AI tooling, React libraries, and visualization."
        path="/projects"
      />
      <h1 className="page__title">Projects</h1>
      <p className="page__lede">
        Open source, pulled from GitHub. Mostly libraries I wanted to exist and
        experiments that got out of hand.
      </p>
      <ProjectGrid id="all-projects" projects={projects} />
    </div>
  )
}
```

- [ ] **Step 6: Fill in the writing page**

Replace `src/pages/Writing.tsx`:

```tsx
import { Seo } from '../components/Seo'
import { PostList } from '../components/PostList/PostList'
import { allPosts } from '../content/posts'
import './pages.css'

export default function Writing() {
  return (
    <div className="page">
      <Seo
        title="Writing"
        description="Essays on AI, software architecture, and building systems that hold up."
        path="/writing"
      />
      <h1 className="page__title">Writing</h1>
      <p className="page__lede">Notes on AI, architecture, and the systems underneath.</p>
      <PostList id="all-posts" posts={allPosts} />
    </div>
  )
}
```

- [ ] **Step 7: Fill in the post page**

Replace `src/pages/Post.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { getAdjacentPosts, getPost } from '../content/posts'
import NotFound from './NotFound'
import './pages.css'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined
  if (!post) return <NotFound />

  const { previous, next } = getAdjacentPosts(post.slug)

  return (
    <article className="article">
      <Seo
        title={post.frontmatter.title}
        description={post.frontmatter.description}
        path={`/writing/${post.slug}`}
        type="article"
      />

      <div className="article__meta">
        <time dateTime={post.frontmatter.date}>{formatDate(post.frontmatter.date)}</time>
        <span>·</span>
        <span>{post.readingTime} min read</span>
      </div>

      <h1 className="article__title">{post.frontmatter.title}</h1>

      {post.toc.length > 1 && (
        <nav className="article__toc" aria-label="Table of contents">
          <ul>
            {post.toc.map((heading) => (
              <li key={heading.id} data-depth={heading.depth}>
                <a href={`#${heading.id}`}>{heading.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Markdown was compiled to HTML at build time by our own Vite plugin. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />

      <nav className="article__nav" aria-label="Post navigation">
        {previous
          ? <Link to={`/writing/${previous.slug}`}>← {previous.frontmatter.title}</Link>
          : <span />}
        {next
          ? <Link to={`/writing/${next.slug}`}>{next.frontmatter.title} →</Link>
          : <span />}
      </nav>
    </article>
  )
}
```

- [ ] **Step 8: Fill in the about page**

Replace `src/pages/About.tsx`:

```tsx
import { Seo } from '../components/Seo'
import './pages.css'

export default function About() {
  return (
    <div className="page">
      <Seo
        title="About"
        description="Michael Shafir is a software architect building with AI."
        path="/about"
      />
      <h1 className="page__title">About</h1>
      <div className="prose" style={{ maxWidth: 'var(--measure)' }}>
        <p>
          I'm Michael Shafir, a software architect. I spend my time on the shape
          of systems — how the pieces divide, where the seams go, and which
          decisions are expensive to reverse later.
        </p>
        <p>
          Lately that work has been about AI: what changes when a language model
          is a component in your architecture rather than a product on top of it,
          and which of our habits survive the transition.
        </p>
        <h2>Elsewhere</h2>
        <ul>
          <li><a href="https://github.com/mshafir">GitHub</a> — @mshafir</li>
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Verify everything renders**

Run: `npm test && npm run build && npm run preview`
Expected: tests pass, build succeeds, the preview shows the hero, tiles, post
list, and a styled article. Check a 375px viewport: no shortcut bar, single
column tiles, portrait above the text.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: fill in home, projects, writing, post and about pages"
```

---

### Task 12: Build verification and deployment

**Files:**
- Create: `src/build-output.test.ts`
- Create: `public/.nojekyll`
- Create: `.github/workflows/deploy.yml`
- Create: `.github/workflows/refresh-projects.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: the completed build from Tasks 1-11.
- Produces: a test asserting the static output is correct, and two GitHub Actions workflows.

- [ ] **Step 1: Write the failing build-output test**

Create `src/build-output.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allPosts } from './content/posts'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const read = (path: string) => readFileSync(resolve(dist, path), 'utf8')

// Asserts on real build output, so it only runs once `dist/` exists.
const describeBuild = existsSync(dist) ? describe : describe.skip

describeBuild('static build output', () => {
  it('prerenders every top-level route', () => {
    for (const path of [
      'index.html', 'projects/index.html', 'writing/index.html', 'about/index.html',
    ]) {
      expect(existsSync(resolve(dist, path)), path).toBe(true)
    }
  })

  it('prerenders a page per post', () => {
    for (const post of allPosts) {
      expect(existsSync(resolve(dist, `writing/${post.slug}/index.html`)), post.slug).toBe(true)
    }
  })

  it('puts each post title into its own static html', () => {
    for (const post of allPosts) {
      expect(read(`writing/${post.slug}/index.html`)).toContain(post.frontmatter.title)
    }
  })

  it('puts post prose into the static html, not only the bundle', () => {
    const html = read(`writing/${allPosts[0].slug}/index.html`)
    expect(html).toContain('class="prose"')
    expect(html.length).toBeGreaterThan(2000)
  })

  it('gives each route its own canonical url', () => {
    expect(read('projects/index.html')).toContain('https://mshafir.github.io/projects')
    expect(read('about/index.html')).toContain('https://mshafir.github.io/about')
  })

  it('ships a nojekyll marker so underscore paths survive github pages', () => {
    expect(existsSync(resolve(dist, '.nojekyll'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rm -rf dist && npm run build && npx vitest run src/build-output.test.ts
```

Expected: FAIL on the `.nojekyll` assertion.

- [ ] **Step 3: Add the Jekyll opt-out**

```bash
mkdir -p public && touch public/.nojekyll
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run build && npx vitest run src/build-output.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm run build
      # Build-output tests run after the build, against real dist/ files.
      - run: npm test
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 6: Write the nightly refresh workflow**

Create `.github/workflows/refresh-projects.yml`:

```yaml
name: Refresh projects

on:
  schedule:
    - cron: '17 6 * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node scripts/fetch-github.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - name: Commit if the data changed
        run: |
          if git diff --quiet src/data/projects.json; then
            echo "No project changes."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add src/data/projects.json
          git commit -m "chore: refresh github project data"
          git push
```

- [ ] **Step 7: Write the README**

Create `README.md` documenting: `npm install` / `npm run dev`; how to add a post
(a markdown file in `content/posts/` with `title`, `date`, `description`, `tags`,
`draft` frontmatter, compiled to HTML at build time, `draft: true` hides it from
production but not from `npm run dev`); how to refresh data (`npm run data:github`,
`npm run data:voxels`, and editing `content/projects.config.json` to pin featured
order, hide a repo, or override a blurb — both outputs committed so builds work
offline); `npm test` / `npm run build` / `npm run preview`; and the keyboard map
(`?` help, `/` palette, `g h`/`g p`/`g w`/`g a` navigation, `j`/`k` list movement).

- [ ] **Step 8: Run the full verification**

```bash
npm run typecheck && npm run build && npm test
```

Expected: no type errors, a clean build, every suite green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "ci: verify static output and deploy to github pages"
```

---

## Self-Review Notes

Spec coverage — every section of the design maps to a task:

| Spec section | Task |
|---|---|
| Stack, design tokens | 1 |
| Voxel builder pipeline | 2 |
| GitHub fetcher and curation | 3 |
| Markdown plugin, drafts, TOC, reading time | 4 |
| Keyboard scope stack, chords, input suppression | 5 |
| Roving focus on real DOM focus | 6 |
| Routes, prerendering, SEO tags, media query | 7 |
| Shortcut bar, command palette, help overlay | 8 |
| Voxel hero, reduced motion, WebGL fallback, mobile drift | 9 |
| Matrix tiles, shared ticker, IntersectionObserver, focus parity | 10 |
| Page content, prose styles, responsive flow | 11 |
| Build-output test, Pages deploy, nightly refresh | 12 |

Error-handling table coverage: GitHub fetch failure (Task 3, Step 6), WebGL
absent (Task 9, Steps 1-2), missing frontmatter (Task 4, Steps 1 and 3), unknown
route (Task 7, Step 8), canvas context absent (Task 10, Step 4 guards).

Known risk to watch during execution: `vite-react-ssg`'s `RouteRecord` type and
`Head` export are the least-certain APIs here. If they do not resolve as written
in Task 7, read the installed package's own type definitions and adapt — the
routing *shape* (one layout route, a child per page, `getStaticPaths` for posts)
is what matters, not the exact import names.
