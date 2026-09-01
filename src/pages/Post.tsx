import { useParams } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { getPost } from '../content/posts'
import NotFound from './NotFound'

export default function Post() {
  const { slug } = useParams<{ slug: string }>()
  const post = slug ? getPost(slug) : undefined
  if (!post) return <NotFound />
  return (
    <>
      <Seo
        title={post.frontmatter.title}
        description={post.frontmatter.description}
        path={`/writing/${post.slug}`}
        type="article"
      />
      <h1>{post.frontmatter.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.html }} />
    </>
  )
}
