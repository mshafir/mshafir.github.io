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
