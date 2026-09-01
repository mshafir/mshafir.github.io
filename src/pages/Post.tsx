import { Link, useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { getAdjacentPosts, getPost } from '../content/posts'
import NotFound from './NotFound'
import './pages.css'

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
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
        {previous ? (
          <Link to={`/writing/${previous.slug}`}>← {previous.frontmatter.title}</Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/writing/${next.slug}`}>{next.frontmatter.title} →</Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
