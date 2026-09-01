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
npm run data:voxels    # rebuild the voxel portrait from assets/source/headshot.png
```

Edit `content/projects.config.json` to pin the featured order, hide a repo, or
override a description. Both outputs are committed, so a build never needs
network access. A nightly workflow re-runs the GitHub fetch and commits it when
stars or push dates change.

Voxel tuning (grid resolution, dome and relief depth, contrast) lives in
`DEFAULTS` at the top of `scripts/lib/voxelize.mjs`.

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
