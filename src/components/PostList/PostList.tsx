import { Link } from 'react-router-dom'
import { useRovingFocus } from '../../keyboard/useRovingFocus'
import type { Post } from '../../content/posts'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
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
                    <span className="post-list__tag" key={tag}>
                      {tag}
                    </span>
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
