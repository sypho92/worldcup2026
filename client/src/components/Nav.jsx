import { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'

const NAV_ITEMS = [
  {
    path: '/',
    label: 'Accueil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline strokeLinecap="round" strokeLinejoin="round" points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    path: '/bets',
    label: 'Mes paris',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="9" y1="12" x2="15" y2="12" strokeLinecap="round" />
        <line x1="9" y1="16" x2="13" y2="16" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/scoreboard',
    label: 'Classement',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="18" y1="20" x2="18" y2="10" strokeLinecap="round" />
        <line x1="12" y1="20" x2="12" y2="4" strokeLinecap="round" />
        <line x1="6" y1="20" x2="6" y2="14" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    path: '/tableau',
    label: 'Tableau',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    path: '/feed',
    label: 'Feed',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    path: '/challenges',
    label: 'Défis',
    hasBadge: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 19l6-6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 21l2.5-2.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 3h4v4L10 18l-4-4L17 3z" />
      </svg>
    ),
  },
  {
    path: '/admin',
    label: 'Admin',
    sidebarOnly: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
      </svg>
    ),
  },
]

export default function Nav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { player, logout, challenges } = useApp()

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  // Count pending challenges + cancel requests that need a response from the current player
  const pendingCount = useMemo(() => {
    if (!player || !challenges) return 0
    return Object.values(challenges).filter((c) => {
      // New challenge received
      if (c.challengedId === player.pseudoId && c.status === 'pending') return true
      // Cancel request from opponent waiting for our answer
      if (
        c.status === 'cancel_requested' &&
        c.cancelRequestedBy !== player.pseudoId &&
        (c.challengerId === player.pseudoId || c.challengedId === player.pseudoId)
      ) return true
      return false
    }).length
  }, [challenges, player])

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Pronos du Peuple" className="sidebar-logo-img" />
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              {item.label}
              {item.hasBadge && pendingCount > 0 && (
                <span className="nav-badge nav-badge--sidebar">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>

        {player && (
          <div className="sidebar-player">
            <span className="player-avatar"><AvatarDisplay avatar={player.avatar} size={28} /></span>
            <span className="player-name">{player.name}</span>
            <button className="logout-btn" onClick={logout}>Quitter</button>
          </div>
        )}
      </aside>

      {/* Bottom nav (mobile) — Admin est sidebar uniquement */}
      <nav className="bottom-nav">
        {NAV_ITEMS.filter((item) => !item.sidebarOnly).map((item) => (
          item.path === '/' ? (
            <button
              key={item.path}
              className={`nav-item nav-item--logo ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate('/')}
            >
              <img src="/logo.png" alt="Accueil" className="nav-logo-img" />
            </button>
          ) : (
            <button
              key={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon-wrap">
                {item.icon}
                {item.hasBadge && pendingCount > 0 && (
                  <span className="nav-badge">{pendingCount}</span>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          )
        ))}
      </nav>
    </>
  )
}
