import { Outlet, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { KeyboardProvider, useKeyboardScope } from '../../keyboard/KeyboardProvider'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { Header } from './Header'
import { SCOPE_PRIORITY, type Binding } from '../../keyboard/types'
import './Layout.css'

/** Global navigation chords, registered once beneath the provider. */
function GlobalScope() {
  const navigate = useNavigate()
  const bindings = useMemo<Binding[]>(
    () => [
      { keys: 'g h', label: 'home', action: () => navigate('/') },
      { keys: 'g p', label: 'projects', action: () => navigate('/projects') },
      { keys: 'g w', label: 'writing', action: () => navigate('/writing') },
      { keys: 'g a', label: 'about', action: () => navigate('/about') },
    ],
    [navigate],
  )
  useKeyboardScope({ id: 'global', bindings, priority: SCOPE_PRIORITY.global })
  return null
}

export function Layout() {
  const isDesktop = useIsDesktop()
  return (
    <KeyboardProvider enabled={isDesktop}>
      <GlobalScope />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" className="layout__main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="layout__footer">
        <span>© {new Date().getFullYear()} Michael Shafir</span>
        <a href="https://github.com/mshafir">github.com/mshafir</a>
      </footer>
    </KeyboardProvider>
  )
}
