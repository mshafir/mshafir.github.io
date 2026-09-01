declare module '*.md' {
  import type { Post } from '../../plugins/markdown/parse'
  const post: Post
  export default post
}
