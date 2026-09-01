import { Seo } from '../components/Seo'
import './pages.css'

export default function About() {
  return (
    <div className="page">
      <Seo
        title="About"
        description="Michael Shafir is a software architect building with AI."
        path="/about"
      />
      <h1 className="page__title">About</h1>
      <div className="prose" style={{ maxWidth: 'var(--measure)' }}>
        <p>
          I'm Michael Shafir, a software architect. I spend my time on the shape of systems — how
          the pieces divide, where the seams go, and which decisions are expensive to reverse
          later.
        </p>
        <p>
          Lately that work has been about AI: what changes when a language model is a component in
          your architecture rather than a product on top of it, and which of our habits survive the
          transition.
        </p>
        <h2>Elsewhere</h2>
        <ul>
          <li>
            <a href="https://github.com/mshafir">GitHub</a> — @mshafir
          </li>
        </ul>
      </div>
    </div>
  )
}
