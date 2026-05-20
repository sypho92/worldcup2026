import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { matches, getPhaseLabel, getPhaseBadgeColor } from '../data/mockData'
import Flag from '../components/Flag'

const PHASES = [
  { key: 'group', label: 'Phase de groupes' },
  { key: 'r32', label: '32e de finale' },
  { key: 'r16', label: '16e de finale' },
  { key: 'qf', label: 'Quarts de finale' },
  { key: 'sf', label: 'Demi-finales' },
  { key: 'third', label: '3e place' },
  { key: 'final', label: 'Finale' },
]

function AdminMatchRow({ match, adminPwd, onSuccess }) {
  const { results, allBets, players } = useApp()
  const result = results[match.id]
  const [homeScore, setHomeScore] = useState(result?.homeScore ?? '')
  const [awayScore, setAwayScore] = useState(result?.awayScore ?? '')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showBets, setShowBets] = useState(false)

  // Compute bet distribution for this match
  const betSummary = useMemo(() => {
    const counts = { home: [], draw: [], away: [] }
    Object.entries(allBets).forEach(([pid, bets]) => {
      const b = bets[match.id]
      if (b && counts[b] !== undefined) {
        counts[b].push(players[pid]?.name || pid)
      }
    })
    return counts
  }, [allBets, match.id, players])

  async function save() {
    if (homeScore === '' || awayScore === '') return
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/results/${match.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd, homeScore: Number(homeScore), awayScore: Number(awayScore) }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg('✓ Enregistré')
        onSuccess && onSuccess()
      } else {
        setMsg('Erreur: ' + data.error)
      }
    } catch {
      setMsg('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/results/${match.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPwd }),
      })
      if (res.ok) {
        setHomeScore('')
        setAwayScore('')
        setMsg('Résultat supprimé')
      }
    } catch {
      setMsg('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const badgeColor = getPhaseBadgeColor(match.phase)
  const winner = result?.winner

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Teams header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: badgeColor + '22', color: badgeColor, textTransform: 'uppercase' }}>
          {match.phase === 'group' ? `Groupe ${match.group} · J${match.matchday}` : getPhaseLabel(match.phase)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{match.date} · {match.time}</span>
      </div>

      <div className="admin-match-row">
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
          <Flag flag={match.homeTeam.flag} size={16} /> {match.homeTeam.name}
        </span>
        <input
          className="score-input"
          type="number"
          min="0"
          max="30"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          placeholder="–"
        />
        <span className="score-sep">:</span>
        <input
          className="score-input"
          type="number"
          min="0"
          max="30"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          placeholder="–"
        />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Flag flag={match.awayTeam.flag} size={16} /> {match.awayTeam.name}
        </span>
        <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }} onClick={save} disabled={saving}>
          {saving ? '...' : 'OK'}
        </button>
        {result && (
          <button className="btn-secondary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={remove} disabled={saving}>
            ✕
          </button>
        )}
      </div>

      {msg && (
        <div style={{ marginTop: 8, fontSize: 12, color: msg.startsWith('✓') ? 'var(--success)' : 'var(--error)' }}>
          {msg}
        </div>
      )}

      {/* Bet distribution */}
      <div style={{ marginTop: 10 }}>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
          onClick={() => setShowBets((o) => !o)}
        >
          Paris ({Object.values(betSummary).flat().length}) {showBets ? '▲' : '▼'}
        </button>
        {showBets && (
          <div className="bet-summary">
            {(['home', 'draw', 'away']).map((o) => (
              <div key={o} className={`bet-summary-item ${o} ${winner === o ? 'correct' : ''}`}>
                <span style={{ fontWeight: 700 }}>{o === 'home' ? '1' : o === 'draw' ? 'N' : '2'}</span>
                <span>{betSummary[o].length > 0 ? betSummary[o].join(', ') : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [adminPwd, setAdminPwd] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [activePhase, setActivePhase] = useState('group')

  async function handleAuth(e) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/auth/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAdminPwd(password)
        setAuthenticated(true)
      } else {
        setAuthError('Mot de passe incorrect.')
      }
    } catch {
      setAuthError('Impossible de contacter le serveur.')
    } finally {
      setAuthLoading(false)
    }
  }

  if (!authenticated) {
    return (
      <div className="page" style={{ maxWidth: 400 }}>
        <h1 className="page-title">Administration</h1>
        <div className="card">
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">Mot de passe admin</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {authError && <p className="form-error">{authError}</p>}
            </div>
            <button type="submit" className="btn-primary w-full" disabled={authLoading}>
              {authLoading ? 'Vérification...' : 'Accéder'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const phaseMatches = matches.filter((m) => m.phase === activePhase)

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Administration</h1>
        <button className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => setAuthenticated(false)}>
          Déconnexion
        </button>
      </div>

      <div className="filter-tabs" style={{ marginBottom: 20 }}>
        {PHASES.map((p) => (
          <button
            key={p.key}
            className={`filter-tab ${activePhase === p.key ? 'active' : ''}`}
            onClick={() => setActivePhase(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {phaseMatches.length === 0 ? (
        <div className="empty-state"><p>Aucun match dans cette phase.</p></div>
      ) : (
        phaseMatches.map((m) => (
          <AdminMatchRow key={m.id} match={m} adminPwd={adminPwd} />
        ))
      )}
    </div>
  )
}
