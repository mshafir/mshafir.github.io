import { ViteReactSSG } from 'vite-react-ssg'
import { routes } from './routes'
import './styles/base.css'

export const createRoot = ViteReactSSG({ routes })
