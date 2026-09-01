import type { RouteRecord } from 'vite-react-ssg'
import { Layout } from './components/Layout/Layout'
import { postSlugs } from './content/posts'
import Home from './pages/Home'
import Projects from './pages/Projects'
import Writing from './pages/Writing'
import Post from './pages/Post'
import About from './pages/About'
import NotFound from './pages/NotFound'

export const routes: RouteRecord[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'projects', element: <Projects /> },
      { path: 'writing', element: <Writing /> },
      {
        path: 'writing/:slug',
        element: <Post />,
        // Tells the SSG crawler which concrete paths to prerender.
        getStaticPaths: () => postSlugs.map((slug) => `/writing/${slug}`),
      },
      { path: 'about', element: <About /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
