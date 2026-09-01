import { Head } from 'vite-react-ssg'

const SITE = 'Michael Shafir'
const ORIGIN = 'https://mshafir.github.io'

export function Seo({
  title,
  description,
  path,
  type = 'website',
}: {
  title: string
  description: string
  path: string
  type?: 'website' | 'article'
}) {
  const fullTitle = path === '/' ? `${SITE} — Software Architect` : `${title} — ${SITE}`
  const url = `${ORIGIN}${path}`
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary_large_image" />
    </Head>
  )
}
