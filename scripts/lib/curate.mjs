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
