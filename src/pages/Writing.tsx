import { Seo } from '../components/Seo'
import { allPosts } from '../content/posts'

export default function Writing() {
  return (
    <>
      <Seo
        title="Writing"
        description="Essays on AI, architecture and building software."
        path="/writing"
      />
      <h1>Writing</h1>
      <ul>
        {allPosts.map((post) => (
          <li key={post.slug}>{post.frontmatter.title}</li>
        ))}
      </ul>
    </>
  )
}
