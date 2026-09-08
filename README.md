# mshafir.github.io

Personal portfolio and blog. React + Vite, prerendered to static HTML, hosted on
GitHub Pages.

## Develop

```bash
npm install
npm run dev
```

## Write a post

Add a markdown file to `content/posts/`. The filename becomes the URL slug.

```markdown
---
title: Your Title
date: 2026-09-14
description: One sentence, used for search results and link previews.
tags: [ai, architecture]
draft: false
---

Prose here.
```

Markdown is compiled to HTML at build time by `plugins/vite-plugin-markdown.ts`,
so posts ship as static content and the browser downloads no markdown parser or
syntax highlighter. `draft: true` hides a post from production builds while
still showing it in `npm run dev`.

## Refresh data

```bash
npm run data:github    # re-fetch GitHub repos into src/data/projects.json
npm run data:figure    # redraw the voxel figure from content/figure/head.json
```

Edit `content/projects.config.yaml` to pin the featured order, hide a repo, or
override a description. Both outputs are committed, so a build never needs
network access. A nightly workflow re-runs the GitHub fetch and commits it when
stars or push dates change.

## The voxel figure

The hero is a cartoon bust drawn to the proportions of a 3D scan of my head.
The scan itself (a Scaniverse export, a textured mesh of head and one shoulder)
is not in the repo; `content/figure/head.json` is, and it holds everything the
figure needs from it: a handful of landmarks and a smoothed shape as a radius
per row and bearing. Two scripts:

- `npm run data:figure:extract` (`scripts/extract-head.mjs`) needs the scan at
  `content/figure/scan.obj` and writes `head.json`. Stages 1 and 2 below.
- `npm run data:figure` (`scripts/build-figure.mjs`) reads `head.json` and
  writes `src/data/voxels.json`. Stage 3. Runs anywhere the repo does.

1. **Voxelize** (`scripts/lib/voxelize.mjs`). Every triangle is sampled at
   sub-voxel spacing and each cell takes the mean of the texels it is hit by.
   A phone scan never captures the crown or the back of the skull, so the shell
   is unioned with an ellipsoid standing in for the cranium, kept strictly
   inside the scanned surface, and the interior is flood-filled solid.
2. **Measure and carve** (`scripts/lib/caricature.mjs`). Landmarks are read
   off that solid: the nose tip is the most forward point of the midline, the
   chin is where the profile steps back onto the neck, the lips are the bulge
   between them, the glasses are the band of dark unsaturated texels on the
   face, and the hairline is where the texture goes dark. The head is then
   reduced to a radius per row and bearing about a vertical axis, smoothed,
   mirrored for symmetry, and pushed a little away from each row's mean so
   what stands out stands out more.
3. **Paint**. The carved head is drawn the way the old hand-authored figure
   was, with flat skin, eyes behind rectangular frames sized to the measured
   band, brows, a smile, stubble, ears, short hair where the texture said hair
   grows, and a suit hung from the chin. The photo texture never reaches the
   page.

The pose (yaw, pitch, roll) and the cranium fit in `extract-head.mjs` are tuned
to this particular scan by eye; the landmarks are measured automatically. To
check a change:

```bash
node scripts/preview-figure.mjs                 # contact sheet of src/data/voxels.json
node scripts/preview-figure.mjs --json out.json # ... of a trial run
```

The original hand-authored cartoon is still here as `scripts/lib/figure.mjs`
(`npm run data:figure:authored`, `--authored` on the preview); the caricature
borrows its palette and noise.

## Test, build, preview

```bash
npm test
npm run typecheck
npm run build
npm run preview
```

`npm run preview` serves `dist/` the way GitHub Pages does, resolving `/about`
to `about/index.html` with no SPA fallback. Do not preview with `vite preview`:
it rewrites every extensionless path to the root `index.html`, so every
prerendered page appears to serve the home page and fail to hydrate.

The build-output suite in `src/build-output.test.ts` asserts against real files
in `dist/`, so run `npm run build` before `npm test` if you want it to execute;
it skips itself when `dist/` is absent.

## Keyboard

Desktop is fully keyboard-driven, with the active shortcuts always listed in the
bar along the bottom.

| Keys | Action |
| --- | --- |
| `g h` `g p` `g w` `g a` | go to home / projects / writing / about |
| `j` `k` | move through the current list |
| `Enter` | open the focused item |
| `/` or `⌘K` | command palette over pages, posts and repos |
| `?` | list every shortcut |
| `1`–`9` | jump to the nth item |
| `Esc` | close an overlay |

Shortcuts drive real DOM focus, so they sit alongside normal Tab navigation
rather than replacing it. Below 768px none of this is rendered and the site
becomes a plain vertical flow.
