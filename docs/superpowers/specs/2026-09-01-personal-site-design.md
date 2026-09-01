# Personal Portfolio + Blog — Design

**Date:** 2026-09-01
**Owner:** Michael Shafir (github.com/mshafir)

## Purpose

A personal site that serves two jobs: a splashy portfolio landing that establishes
Michael as a software architect working with AI, and a durable blog for writing
about AI. The landing is the hook; the blog is the reason to return.

Success criteria:

- The hero is memorable enough to be worth sharing on its own.
- Publishing a post is: drop a markdown file in `content/posts/`, push.
- Every page is fully operable from the keyboard, terminal-style.
- Every page is fully usable on a phone, with no keyboard affordances shown.
- Blog posts are indexable by search engines and produce correct link previews.

## Non-goals

- No CMS, no comments, no newsletter, no analytics in v1.
- No light theme. The site is dark by design.
- No 360-degree sculpted head. The voxel portrait is a bas-relief derived from a photo.

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Build | Vite 7 + React 19 + TypeScript | Requested; fast, familiar |
| Rendering | `vite-react-ssg` | Real HTML per route for SEO and link previews, still React+Vite |
| Routing | `react-router` (via vite-react-ssg routes) | Standard, SSG-aware |
| 3D | `three` + `@react-three/fiber` | Declarative three.js in React |
| Styling | Plain CSS with custom properties, per-component `.css` | No framework tax; the design is small and bespoke |
| Markdown | Build-time Vite plugin: gray-matter + shiki | Client ships HTML strings, zero parser weight |
| Tests | Vitest + React Testing Library | Fast, Vite-native |
| Host | GitHub Pages at `mshafir.github.io` (root path) | Free, no basename complexity |

## Design tokens

```
--bg        #0B0E13   slate near-black
--bg-raised #12161E
--text      #E8E6E1   warm off-white
--dim       #6B7280   muted labels
--accent    #22D3EE   cyan: focus rings, active keys, tile rain
--border    #1F2630
```

Type: a monospace face for chrome (nav, shortcut bar, metadata, code) and a
readable sans for prose. Voxel portrait keeps the photo's natural skin and hair
tones so it reads warm against the cold ground.

## Data pipelines

All three produce committed artifacts, so a build never requires network access.

### 1. Voxel builder — `scripts/build-voxels.mjs`

Input: `assets/source/headshot.png` (512x512 color portrait).

1. Downsample to a 64x64 grid with `sharp`, sampling average color per cell.
2. Cut the silhouette: flood-fill inward from the border, treating a cell as
   background when its color is within a tolerance of the seed border color.
   The source photo's background is a uniform blurred green bokeh, so this is
   reliable. Fill holes; keep the single largest foreground component.
3. Assign depth per surviving cell:
   `z = round(dome(x, y) * DOME_DEPTH + luma(cell) * RELIEF_DEPTH)`
   where `dome` is a radial falloff from the grid center (head curvature) and
   `luma` provides feature relief (nose and forehead forward, eye sockets back).
4. Emit `src/data/voxels.json`:
   `{ size: 64, count: N, voxels: [[x, y, z, r, g, b], ...] }`
   Expected N is roughly 2,000-3,000.

Constants (`DOME_DEPTH`, `RELIEF_DEPTH`, grid size, background tolerance) live at
the top of the script for tuning.

### 2. GitHub fetcher — `scripts/fetch-github.mjs`

Fetches `users/mshafir/repos?sort=pushed`, merges with `content/projects.config.json`:

```json
{
  "featured": ["reactlit", "auto-adventure", "..."],
  "hidden": ["weddingsite", "kavod-crm"],
  "overrides": { "reactlit": { "blurb": "...", "tagline": "..." } }
}
```

Rules: hidden repos and forks are dropped; `featured` sets order and marks the
home-page subset; `overrides.blurb` replaces the GitHub description. Output:
`src/data/projects.json` with `{ name, url, blurb, language, stars, pushedAt, featured }`.

Runs unauthenticated (60 req/hr is ample). If the fetch fails, the script exits
non-zero **without** writing, so a network blip cannot blank the committed file.

### 3. Markdown plugin — `plugins/vite-plugin-markdown.ts`

Transforms `content/posts/*.md` into modules exporting:

```ts
{ slug, frontmatter: { title, date, description, tags, draft }, html, toc, readingTime }
```

Parsing (gray-matter), highlighting (shiki, `github-dark` theme retinted to our
palette), heading extraction, and reading-time estimation all happen in the
plugin at build time. Drafts are excluded when `NODE_ENV === 'production'`.

## Components

### Voxel hero — `src/components/VoxelPortrait/`

Renders `voxels.json` as one `InstancedMesh` of unit boxes with per-instance
color: a single draw call for the whole portrait. Lighting is a key light plus a
cyan rim light that separates the silhouette from the background.

Interaction: pointer position maps to a target rotation of +/-14 degrees yaw and
+/-8 degrees pitch; actual rotation lerps toward the target each frame so motion
is damped and never snaps. When the pointer is idle, a slow sine drift keeps it
breathing. On load, voxels animate from scattered positions to assembled ones,
staggered bottom-to-top over about 1.2s.

Three guards:

- **Prerender safety.** The canvas is a dynamic import mounted only after
  hydration; the SSG pass emits a sized placeholder, so no `window` access at build.
- **Reduced motion.** `prefers-reduced-motion: reduce` renders a static posed
  portrait with no entrance animation and no cursor tracking.
- **No WebGL.** Falls back to a flat 2D canvas painted from the same JSON.

Mobile: no cursor exists, so the portrait auto-rotates slowly instead.

### Matrix tiles — `src/components/ProjectTile/`

Each tile layers a glyph-rain `<canvas>` behind solid type: repo name,
description, language dot, star count, last push.

- One shared rAF ticker drives every tile on the page (`useMatrixTicker`),
  throttled to ~18fps -- the low framerate is the intended look and cuts cost.
- Rain pauses via `IntersectionObserver` when offscreen and on `visibilitychange`.
- At rest the rain is dim slate. On hover **or keyboard focus** it accelerates and
  shifts to accent cyan, so keyboard users get identical feedback to mouse users.
- Glyph set: katakana, digits, and a few code-flavored symbols.
- Reduced motion renders a single static glyph field.

### Keyboard system — `src/keyboard/`

A `KeyboardProvider` maintains a **scope stack**. Components push a scope on
mount and pop on unmount, so bindings are contextual rather than one global map.
The topmost scope resolves a key first; unhandled keys fall through to lower
scopes, with the global scope last.

Global bindings:

| Keys | Action |
|---|---|
| `g h` / `g p` / `g w` / `g a` | go to home / projects / writing / about |
| `j` / `k` | move focus within the active list |
| `Enter` | activate the focused item |
| `Esc` | close overlay, else go back |
| `/` or `Cmd/Ctrl+K` | command palette |
| `?` | shortcut help overlay |
| `1`-`9` | jump to the nth item in the active list |

Chords (`g` then `h`) use a 1.2s pending-prefix timeout. Bindings are suppressed
while focus is inside an input, textarea, or contenteditable.

`useRovingFocus` drives **real DOM focus** rather than a parallel highlight state,
so shortcuts augment native Tab navigation instead of replacing it, and screen
readers stay correct for free.

`ShortcutBar` is fixed to the bottom and renders the active scope's bindings, so
it changes as the user moves between the hero, a list, and a post. It is not
rendered below the `md` breakpoint.

`CommandPalette` fuzzy-matches nav destinations, projects, and posts. It is a
proper modal dialog: focus trap, `aria-modal`, restore focus on close.

## Routes

| Route | Content |
|---|---|
| `/` | Voxel hero + tagline, featured project tiles, latest three posts |
| `/projects` | Full curated grid of matrix tiles |
| `/writing` | Post list: title, date, description, tags, reading time |
| `/writing/:slug` | Post with TOC, reading time, prev/next |
| `/about` | Longer bio, focus areas, contact and social links |

Each route sets its own `<title>`, description, and OG tags during prerender.

## Responsive behavior

Single breakpoint at `768px`. Below it:

- `ShortcutBar` and `CommandPalette` are not rendered, and global key handlers
  are not registered.
- The voxel hero auto-rotates rather than tracking a cursor, at a reduced grid
  scale for fill rate.
- Tile grid collapses to one column; nav collapses to a disclosure menu.
- Layout is plain vertical flow throughout -- no fixed chrome except the header.

## Accessibility

- Skip-to-content link as the first focusable element.
- Visible `:focus-visible` rings in accent cyan on every interactive element.
- Semantic landmarks (`header`, `nav`, `main`, `footer`) and one `h1` per page.
- `prefers-reduced-motion` honored by the hero, the tiles, and all transitions.
- Help overlay and command palette are dialogs with focus traps.
- The canvas hero carries an `aria-label` describing the portrait; the rain
  canvases are `aria-hidden` decoration.

## Error handling

| Failure | Behavior |
|---|---|
| GitHub fetch fails at build | Script exits non-zero without writing; committed `projects.json` stands |
| WebGL unavailable | 2D canvas fallback portrait |
| `voxels.json` missing | Hero renders the tagline alone; build warns |
| Post frontmatter missing `title` or `date` | Plugin throws at build with the file path |
| Unknown route | 404 page with nav and the command palette |
| Canvas context unavailable for a tile | Tile renders as static type on a flat ground |

## Testing

Vitest + RTL, targeting logic that can actually regress:

- **Keyboard registry** -- chord resolution, prefix timeout, scope stacking and
  fall-through, suppression inside inputs.
- **Roving focus** -- `j`/`k` movement, wrap at both ends, numeric jump, focus
  actually lands on the DOM node.
- **Markdown plugin** -- frontmatter parsing, draft filtering by env, TOC
  extraction, reading time, and the missing-field error.
- **Projects curation** -- fork and hidden exclusion, featured ordering, blurb
  override precedence.
- **Voxel builder** -- against a small fixture image: background is cut, voxel
  count and coordinate bounds are within expectation, output schema is valid.
- **Build output** -- after `npm run build`, assert the expected HTML files exist
  and each post page contains its title.

Three.js visual output is not unit-tested.

## Repository layout

```
assets/source/headshot.png
content/posts/*.md
content/projects.config.json
plugins/vite-plugin-markdown.ts
scripts/build-voxels.mjs
scripts/fetch-github.mjs
src/
  components/{VoxelPortrait,ProjectTile,ShortcutBar,CommandPalette,...}/
  keyboard/{KeyboardProvider,useRovingFocus,bindings}
  data/{voxels.json,projects.json}
  pages/{Home,Projects,Writing,Post,About,NotFound}
  styles/{tokens.css,base.css}
.github/workflows/deploy.yml
```

## Deployment

GitHub Action on push to `main`: install, run tests, `npm run build`, deploy
`dist/` to Pages. A separate nightly scheduled job re-runs `fetch-github.mjs`
and commits `projects.json` if star counts or push dates changed.
