import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { matches, getPhaseLabel, getPhaseBadgeColor, isKnockout } from '../data/mockData'
import Flag from '../components/Flag'

const TOTAL = matches.length

// Abrège un nom d'équipe en 3 lettres max
function abbrev(name) {
  const words = name.split(' ')
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3)
}

// Groupe les matchs par date (string YYYY-MM-DD)
function groupByDate(matchList) {
  const map = {}
  matchList.forEach((m) => {
    if (!map[m.date]) map[m.date] = []
    map[m.date].push(m)
  })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const yesterday = new Date(now)
  const tomorrow = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  tomorrow.setDate(now.getDate() + 1)

  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  if (d.toDateString() === tomorrow.toDateString()) return 'Demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isDateToday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toDateString() === new Date().toDateString()
}

// ─── Barre de répartition des paris ─────────────────────────────────────────

function BetBar({ match }) {
  const { allBets } = useApp()
  const knockout = isKnockout(match.phase)

  let home = 0, draw = 0, away = 0
  Object.values(allBets).forEach((pb) => {
    const b = pb[match.id]
    if (b === 'home') home++
    else if (b === 'draw' && !knockout) draw++
    else if (b === 'away') away++
  })

  const total = home + draw + away
  if (total === 0) return null

  const pHome = Math.round((home / total) * 100)
  const pDraw = knockout ? 0 : Math.round((draw / total) * 100)
  const pAway = 100 - pHome - pDraw

  return (
    <div className="bet-bar">
      <div className="bet-bar-labels">
        <span className="bet-bar-side bet-bar-side--home">
          <Flag flag={match.homeTeam.flag} size={12} />
          {abbrev(match.homeTeam.name)} <strong>{pHome}%</strong>
        </span>
        {!knockout && pDraw > 0 && (
          <span className="bet-bar-side bet-bar-side--draw">Nul {pDraw}%</span>
        )}
        <span className="bet-bar-side bet-bar-side--away">
          <strong>{pAway}%</strong> {abbrev(match.awayTeam.name)}
          <Flag flag={match.awayTeam.flag} size={12} />
        </span>
      </div>
      <div className="bet-bar-track">
        {pHome > 0 && <div className="bet-bar-fill bet-bar-fill--home" style={{ width: `${pHome}%` }} />}
        {pDraw > 0 && <div className="bet-bar-fill bet-bar-fill--draw" style={{ width: `${pDraw}%` }} />}
        {pAway > 0 && <div className="bet-bar-fill bet-bar-fill--away" style={{ width: `${pAway}%` }} />}
      </div>
    </div>
  )
}

// ─── Ligne de match style lolesports ────────────────────────────────────────

function ScheduleRow({ match }) {
  const { results, myBets, placeBet, isMatchLocked } = useApp()

  const result = results[match.id]
  const bet = myBets[match.id]
  const finished = !!result
  const locked = !finished && isMatchLocked(match)
  const knockout = isKnockout(match.phase)
  const badgeColor = getPhaseBadgeColor(match.phase)

  const phaseLabel =
    match.phase === 'group'
      ? `Groupe ${match.group} · J${match.matchday}`
      : getPhaseLabel(match.phase)

  let rowClass = 'sched-row'
  if (finished && bet) rowClass += bet === result.winner ? ' sched-row--correct' : ' sched-row--wrong'
  else if (bet && !locked) rowClass += ' sched-row--bet'
  else if (locked) rowClass += ' sched-row--locked'

  function getBtnState(outcome) {
    if (bet === outcome) return 'selected'
    return ''
  }

  return (
    <div className={rowClass}>
      <div className="sched-time-badge">{match.time}</div>

      <div className="sched-main">
        <div className="sched-teams">
          <span className="sched-name">{abbrev(match.homeTeam.name)}</span>
          <Flag flag={match.homeTeam.flag} size={40} />

          {finished ? (
            <span className="sched-score">{result.homeScore} – {result.awayScore}</span>
          ) : (
            <span className="sched-sep">/</span>
          )}

          <Flag flag={match.awayTeam.flag} size={40} />
          <span className="sched-name">{abbrev(match.awayTeam.name)}</span>
        </div>

        <div className="sched-right">
          {finished && bet && (
            <span className={`sched-result-icon ${bet === result.winner ? 'correct' : 'wrong'}`}>
              {bet === result.winner ? '✓' : '✗'}
            </span>
          )}
          {locked && (
            <span className="sched-locked-badge">En cours</span>
          )}
        </div>
      </div>

      <div className="sched-footer">
        <span className="sched-phase-badge" style={{ color: badgeColor }}>
          {phaseLabel}
        </span>
        <span className="sched-venue">{match.venue.split(',')[0]}</span>
      </div>

      <BetBar match={match} />

      {/* Boutons de pari — visibles uniquement si le match n'a pas commencé */}
      {!finished && !locked && (
        <div className="sched-bet-row">
          <button
            className={`sched-bet-btn ${getBtnState('home')}`}
            onClick={() => placeBet(match.id, 'home')}
          >
            <Flag flag={match.homeTeam.flag} size={28} /> {abbrev(match.homeTeam.name)}
          </button>
          {!knockout && (
            <button
              className={`sched-bet-btn ${getBtnState('draw')}`}
              onClick={() => placeBet(match.id, 'draw')}
            >
              Nul
            </button>
          )}
          <button
            className={`sched-bet-btn ${getBtnState('away')}`}
            onClick={() => placeBet(match.id, 'away')}
          >
            <Flag flag={match.awayTeam.flag} size={28} /> {abbrev(match.awayTeam.name)}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Section de date ─────────────────────────────────────────────────────────

function DateSection({ dateStr, dayMatches }) {
  const today = isDateToday(dateStr)
  const header = formatDateHeader(dateStr)

  return (
    <div className="sched-section">
      <div className={`sched-date-header ${today ? 'sched-date-header--today' : ''}`}>
        {header}
      </div>

      {dayMatches.length === 0 ? (
        <div className="sched-empty">
          <strong>Aucun match prévu aujourd'hui</strong>
          <span>Revenez plus tard</span>
        </div>
      ) : (
        <div className="sched-day">
          {dayMatches.map((m) => <ScheduleRow key={m.id} match={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { player, myPoints, myBetsCount, playedCount, scoreboard, results } = useApp()
  const [filter, setFilter] = useState('all')
  const todayRef = useRef(null)

  const rank = useMemo(() => {
    const board = scoreboard()
    const idx = board.findIndex((p) => p.pseudoId === player?.pseudoId)
    return idx === -1 ? '—' : idx + 1
  }, [scoreboard, player])

  const progress = TOTAL > 0 ? Math.round((playedCount / TOTAL) * 100) : 0

  const filteredMatches = useMemo(() => {
    if (filter === 'upcoming') return matches.filter((m) => !results[m.id])
    if (filter === 'played') return matches.filter((m) => results[m.id])
    return matches
  }, [filter, results])

  const today = new Date().toISOString().split('T')[0]
  const byDate = groupByDate(filteredMatches)
  const hasTodaySection = byDate.some(([d]) => d === today)
  const sections = hasTodaySection
    ? byDate
    : [
        ...byDate.filter(([d]) => d < today),
        [today, []],
        ...byDate.filter(([d]) => d > today),
      ]

  const stickyRef = useRef(null)

  useEffect(() => {
    if (!todayRef.current) return
    const stickyHeight = stickyRef.current ? stickyRef.current.offsetHeight : 0
    const top = todayRef.current.getBoundingClientRect().top + window.scrollY - stickyHeight
    window.scrollTo(0, Math.max(0, top))
  }, [])

  return (
    <div className="page sched-page">

      {/* ── En-tête sticky ── */}
      <div className="sched-sticky-top" ref={stickyRef}>

        {/* Header compact */}
        <div className="sched-header">
          <div className="sched-greeting">
            <span className="sched-avatar">{player?.avatar}</span>
            <div>
              <div className="sched-greeting-name">{player?.name}</div>
              <div className="sched-greeting-sub">Coupe du Monde 2026</div>
            </div>
          </div>

          <div className="sched-stats">
            <div className="sched-stat">
              <span className="sched-stat-val">{myPoints.total}</span>
              <span className="sched-stat-lbl">pts</span>
            </div>
            <div className="sched-stat-div" />
            <div className="sched-stat">
              <span className="sched-stat-val">{myBetsCount}</span>
              <span className="sched-stat-lbl">paris</span>
            </div>
            <div className="sched-stat-div" />
            <div className="sched-stat">
              <span className="sched-stat-val">{rank}</span>
              <span className="sched-stat-lbl">rang</span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="sched-progress">
          <div className="sched-progress-bar">
            <div className="sched-progress-fill" style={{ width: `${progress}%` }}>
              <div className="sched-progress-spark" />
            </div>
          </div>
          <div className="sched-progress-label">
            <span>{playedCount} matchs joués</span>
            <span>{TOTAL - playedCount} restants</span>
          </div>
        </div>

        {/* Filtres */}
        <div className="sched-filters">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'upcoming', label: 'À venir' },
            { key: 'played', label: 'Joués' },
          ].map((f) => (
            <button
              key={f.key}
              className={`sched-filter ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Schedule par date ── */}
      <div className="sched-list">
        {sections.map(([dateStr, dayMatches]) => (
          <div key={dateStr} ref={dateStr === today ? todayRef : null}>
            <DateSection dateStr={dateStr} dayMatches={dayMatches} />
          </div>
        ))}
      </div>

    </div>
  )
}
