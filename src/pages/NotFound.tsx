import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'

export default function NotFound() {
  return (
    <div style={{ padding: 'var(--space-16) var(--space-6)' }}>
      <Seo title="Not found" description="That page does not exist." path="/404" />
      <h1>404</h1>
      <p>No route matches that path.</p>
      <Link to="/">Back home</Link>
    </div>
  )
}
