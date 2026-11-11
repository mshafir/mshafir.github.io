# Site Editor

A local desktop app for writing posts and curating projects on this site. It edits the
repo's files directly; you commit and push yourself.

```bash
cd editor
npm install
npm start          # build, then open the app
npm run dev        # same, with hot reload for the window (restart for main-process changes)
npm test
```

**Ubuntu 23.10+:** Chromium's sandbox can't start there out of the box and Electron aborts with
_"The SUID sandbox helper binary was found, but is not configured correctly"_. Fix it once:

```bash
sudo chown root:root node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 node_modules/electron/dist/chrome-sandbox
```

(or run `npm start -- --no-sandbox`). Reinstalling Electron undoes the fix.

## What it writes

| In the app | On disk |
| --- | --- |
| Posts | `content/posts/<slug>.md` — frontmatter plus markdown. Renaming the slug renames the file. |
| Draft / Published | `draft: true` in frontmatter, or no `draft` key. Publishing a draft sets its date to today. |
| Images in a post | `public/images/<slug>/<name>`, referenced as `/images/<slug>/<name>` |
| Media → Add images | `public/images/uploads/` |
| Projects | `content/projects.config.yaml` (featured order, hidden, blurbs, custom projects), then `src/data/projects.json` regenerated with the site's own `scripts/lib/curate.mjs` |
| Delete | Moves the file to the system Trash |

Everything autosaves about half a second after you stop typing. Opening a post never writes
it; only an edit does, so untouched files stay byte-identical. The visual editor saves
standard markdown (hard-wrapped paragraphs become one line the first time a post is edited).

The **Markdown** button flips to the raw markdown body, for anything the toolbar can't do.

## Projects

GitHub repo details come from the GitHub API (cached in the app's data folder, refreshable
with the ↻ button). Offline, the app falls back to the committed `projects.json`. The site
shows featured projects first, in your order, then the rest by most recent activity, so only
the featured order is draggable. **Add project** creates a custom (non-GitHub) entry under
`custom:` in the config.

## Layout

- `electron/` — main process: file access (`site.ts`), post files, the projects config
- `src/` — the window (React + TipTap)
- Set `SITE_ROOT` to point the app at a different checkout.
