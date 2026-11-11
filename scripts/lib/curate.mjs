/**
 * Merge the raw GitHub repo listing with hand-authored curation: hide repos,
 * pin a featured order, override blurbs, and add projects that are not
 * GitHub repos at all (`custom`: a talk, a link, a write-up).
 */
export function curate(repos, config = {}) {
  const featured = config.featured ?? []
  const hidden = new Set(config.hidden ?? [])
  const overrides = config.overrides ?? {}
  const custom = config.custom ?? []

  const fromGitHub = repos
    .filter((repo) => !repo.fork)
    .map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      blurb: overrides[repo.name]?.blurb ?? repo.description ?? '',
      language: repo.language ?? null,
      stars: repo.stargazers_count ?? 0,
      pushedAt: repo.pushed_at,
      featured: featured.includes(repo.name),
    }))

  const fromConfig = custom.map((entry) => ({
    name: entry.name,
    url: entry.url ?? '',
    blurb: entry.blurb ?? '',
    language: entry.language ?? null,
    stars: 0,
    pushedAt: entry.date ? String(entry.date) : '',
    featured: featured.includes(entry.name),
    custom: true,
  }))

  const projects = [...fromGitHub, ...fromConfig].filter((project) => !hidden.has(project.name))

  const rank = (project) =>
    project.featured ? featured.indexOf(project.name) : Number.MAX_SAFE_INTEGER

  return projects.sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) return byRank
    return b.pushedAt.localeCompare(a.pushedAt)
  })
}
