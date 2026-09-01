import { NavLink } from 'react-router-dom'
import './Header.css'

const LINKS = [
  { to: '/', label: 'home', chord: 'g h', end: true },
  { to: '/projects', label: 'projects', chord: 'g p', end: false },
  { to: '/writing', label: 'writing', chord: 'g w', end: false },
  { to: '/about', label: 'about', chord: 'g a', end: false },
]

export function Header() {
  return (
    <header className="header">
      <NavLink to="/" className="header__brand" end>
        michael<span className="header__brand-dim">.shafir</span>
      </NavLink>
      <nav className="header__nav" aria-label="Main">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              isActive ? 'header__link header__link--active' : 'header__link'
            }
          >
            {link.label}
            <span className="header__chord" aria-hidden="true">
              {link.chord}
            </span>
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
