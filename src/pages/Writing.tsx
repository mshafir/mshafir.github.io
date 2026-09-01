import { Seo } from '../components/Seo'
import { PostList } from '../components/PostList/PostList'
import { allPosts } from '../content/posts'
import './pages.css'

export default function Writing() {
  return (
    <div className="page">
      <Seo
        title="Writing"
        description="Essays on AI, software architecture, and building systems that hold up."
        path="/writing"
      />
      <h1 className="page__title">Writing</h1>
      <p className="page__lede">Notes on AI, architecture, and the systems underneath.</p>
      <PostList id="all-posts" posts={allPosts} />
    </div>
  )
}
