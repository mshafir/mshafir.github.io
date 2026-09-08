import { AuthorshipNote } from '../components/AuthorshipNote/AuthorshipNote'
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
          I'm Michael Shafir, I like thinking about software systems, how to build products people like, how to solve problems.
          I studied machine learning and worked on AI, then switched to healthcare tech, now work predominantly for a commercial maritime ERP vendor,
          I'm in that huge pool of folks rethinking what they do now and what it all means.
        </p>
        <h2>What I use for dev right now</h2>
        <ul>
          <li>claude code always dangerously</li>
          <li>herdr on ghostty - just amazing, collie + tailscale for mobile</li>
          <li>zed - rarely for code browsing/editing</li>
          <li>a smattering of smaller tools: worktrunk, glow, codegraph, tokensave, claude-switch, superpowers</li>
        </ul>
        <h2>Preferred frameworks/services/clouds</h2>
        <ul>
          <li>TypeScript</li>
          <li>mise,pnpm,biome,turborepo</li>
          <li>Tanstack (Query, Router) usually with vite, don't typically need Start</li>
          <li>Shadcn/Tailwind/BaseUI</li>
          <li>Supabase</li>
          <li>Cloudflare workers & tunnels</li>
          <li>prefer GCP over AWS</li>
          <li>I've taken to having claude host containerized stuff for me on EC2s instead of k8s et al - the cost is no longer worth it, claude writes great terraform</li>
        </ul>
        <h2>On authorship</h2>
        <AuthorshipNote />
        <ul>
          <li>
            <a href="https://github.com/mshafir">GitHub</a> — @mshafir
          </li>
        </ul>
      </div>
    </div>
  )
}
