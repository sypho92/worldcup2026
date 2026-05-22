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

  // Count pending challenges received by the current player
  const pendingCount = useMemo(() => {
    if (!player || !challenges) return 0
    return Object.values(challenges).filter(
      (c) => c.challengedId === player.pseudoId && c.status === 'pending'
    ).length
  }, [challenges, player])

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-emblem">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="26" height="26">
              <circle cx="16" cy="16" r="13.5" stroke="rgba(212,152,30,0.7)" strokeWidth="1.3" fill="rgba(212,152,30,0.08)"/>
              <polygon points="16,7.5 19.8,10.8 18.3,15.2 13.7,15.2 12.2,10.8" fill="rgba(212,152,30,0.9)"/>
              <polygon points="8.5,10.5 12.2,10.8 13.7,15.2 9.8,18 6.8,15.5" fill="rgba(212,152,30,0.35)" stroke="rgba(212,152,30,0.5)" strokeWidth="0.6"/>
              <polygon points="23.5,10.5 19.8,10.8 18.3,15.2 22.2,18 25.2,15.5" fill="rgba(212,152,30,0.35)" stroke="rgba(212,152,30,0.5)" strokeWidth="0.6"/>
              <polygon points="16,24.5 12.2,22 9.8,18 13.7,15.2 18.3,15.2 22.2,18 19.8,22" fill="rgba(212,152,30,0.25)" stroke="rgba(212,152,30,0.5)" strokeWidth="0.6"/>
            </svg>
          </div>
          <div className="logo-text-block">
            <span className="logo-title">WORLD CUP</span>
            <span className="logo-year">2026</span>
          </div>
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
        ))}
      </nav>
    </>
  )
}
