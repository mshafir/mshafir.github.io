import { Outlet, useNavigate } from 'react-router-dom'
import { useCallback, useMemo, useState } from 'react'
import { KeyboardProvider, useKeyboardScope } from '../../keyboard/KeyboardProvider'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { ShortcutBar } from '../ShortcutBar/ShortcutBar'
import { CommandPalette } from '../CommandPalette/CommandPalette'
import { HelpOverlay } from '../HelpOverlay/HelpOverlay'
import { Header } from './Header'
import { SCOPE_PRIORITY, type Binding } from '../../keyboard/types'
import './Layout.css'

type Overlay = 'none' | 'palette' | 'help'

function GlobalScope({ setOverlay }: { setOverlay: (overlay: Overlay) => void }) {
  const navigate = useNavigate()
  const bindings = useMemo<Binding[]>(
    () => [
      { keys: 'g h', label: 'home', action: () => navigate('/') },
      { keys: 'g p', label: 'projects', action: () => navigate('/projects') },
      { keys: 'g w', label: 'writing', action: () => navigate('/writing') },
      { keys: 'g a', label: 'about', action: () => navigate('/about') },
      { keys: '/', label: 'search', action: () => setOverlay('palette') },
      { keys: 'mod+k', label: 'search', hidden: true, action: () => setOverlay('palette') },
      { keys: '?', label: 'help', action: () => setOverlay('help') },
    ],
    [navigate, setOverlay],
  )
  useKeyboardScope({ id: 'global', bindings, priority: SCOPE_PRIORITY.global })
  return null
}

/** Pushed while an overlay is open: Escape closes and nothing else leaks. */
function OverlayScope({ onClose }: { onClose: () => void }) {
  const bindings = useMemo<Binding[]>(
    () => [{ keys: 'Escape', label: 'close', action: onClose, allowInInput: true }],
    [onClose],
  )
  useKeyboardScope({ id: 'overlay', bindings, priority: SCOPE_PRIORITY.overlay })
  return null
}

export function Layout() {
  const isDesktop = useIsDesktop()
  const [overlay, setOverlay] = useState<Overlay>('none')
  const close = useCallback(() => setOverlay('none'), [])

  return (
    <KeyboardProvider enabled={isDesktop}>
      <GlobalScope setOverlay={setOverlay} />
      {overlay !== 'none' && <OverlayScope onClose={close} />}
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
      {isDesktop && (
        <>
          <ShortcutBar />
          <CommandPalette open={overlay === 'palette'} onClose={close} />
          <HelpOverlay open={overlay === 'help'} onClose={close} />
        </>
      )}
    </KeyboardProvider>
  )
}
