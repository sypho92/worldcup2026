import { useState, useMemo, useEffect } from 'react'
import { ref, onValue, remove } from 'firebase/database'
import { db } from '../firebase'
import { useApp } from '../context/AppContext'
import { getPhaseLabel, getPhaseBadgeColor } from '../utils/format'
import Flag from '../components/Flag'
import { AvatarDisplay } from '../components/AvatarDisplay'

const PHASES = [
  { key: 'group', label: 'Phase de groupes' },
  { key: 'r32', label: 'Seizième de finale' },
  { key: 'r16', label: 'Huitième de finale' },
  { key: 'qf', label: 'Quarts de finale' },
  { key: 'sf', label: 'Demi-finales' },
  { key: 'third', label: '3e place' },
  { key: 'final', label: 'Finale' },
]

/* ── Player manager (admin) ────────────────────────────────────────────────── */
function PlayerManager() {
  const { players, allBets, deletePlayer, player: me } = useApp()
  const [confirming, setConfirming] = useState(null) // pseudoId being confirmed
  const [deleting, setDeleting]     = useState(null)
  const [deleted, setDeleted]       = useState([])   // keep track for instant UI feedback

  const list = useMemo(() =>
    Object.entries(players)
      .filter(([id]) => !deleted.includes(id))
      .map(([id, p]) => ({
        pseudoId: id,
        name: p.name,
        avatar: p.avatar,
        betsCount: Object.keys(allBets[id] || {}).length,
        isMe: id === me?.pseudoId,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [players, allBets, deleted, me]
  )

  async function handleDelete(pseudoId) {
    setDeleting(pseudoId)
    try {
      await deletePlayer(pseudoId)
      setDeleted((d) => [...d, pseudoId])
    } catch (e) {
      alert('Erreur lors de la suppression.')
    } finally {
      setDeleting(null)
      setConfirming(null)
    }
  }

  return (
    <div className="admin-players">
      <p className="admin-players-hint">
        {list.length} compte{list.length !== 1 ? 's' : ''} enregistré{list.length !== 1 ? 's' : ''}. La suppression efface le compte, tous les paris et les défis associés.
      </p>
      <div className="admin-players-list">
        {list.map((p) => (
          <div key={p.pseudoId} className="admin-player-row">
            <AvatarDisplay avatar={p.avatar} size={36} />
            <div className="admin-player-info">
              <span className="admin-player-name">
                {p.name}
                {p.isMe && <span className="admin-player-me"> (vous)</span>}
              </span>
              <span className="admin-player-meta">{p.pseudoId} · {p.betsCount} paris</span>
            </div>

            {p.isMe ? (
              <span className="admin-player-protected">protégé</span>
            ) : confirming === p.pseudoId ? (
              <div className="admin-player-confirm">
                <span className="admin-player-confirm-text">Supprimer ?</span>
                <button
                  className="admin-player-confirm-cancel"
                  onClick={() => setConfirming(null)}
                >
                  Non
                </button>
                <button
                  className="admin-player-confirm-ok"
                  onClick={() => handleDelete(p.pseudoId)}
                  disabled={deleting === p.pseudoId}
                >
                  {deleting === p.pseudoId ? '...' : 'Oui'}
                </button>
              </div>
            ) : (
              <button
                className="admin-player-delete"
                onClick={() => setConfirming(p.pseudoId)}
              >
                🗑 Supprimer
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

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

function ModerationTab() {
  const { matches } = useApp()
  const [feedPosts, setFeedPosts] = useState([])
  const [matchComments, setMatchComments] = useState([]) // [{matchId, commentId, ...data}]
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    const unsub = onValue(ref(db, 'feed'), (snap) => {
      const val = snap.val() || {}
      setFeedPosts(Object.entries(val).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.createdAt - a.createdAt))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onValue(ref(db, 'match_comments'), (snap) => {
      const val = snap.val() || {}
      const all = []
      Object.entries(val).forEach(([matchId, comments]) => {
        Object.entries(comments).forEach(([commentId, c]) => {
          all.push({ matchId, commentId, ...c })
        })
      })
      all.sort((a, b) => b.createdAt - a.createdAt)
      setMatchComments(all)
    })
    return () => unsub()
  }, [])

  function matchLabel(matchId) {
    const m = matches.find((x) => x.id === matchId)
    if (!m) return matchId
    return `${m.homeTeam?.name ?? '?'} – ${m.awayTeam?.name ?? '?'}`
  }

  function fmt(ts) {
    return new Date(ts).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  async function deleteFeed(id) {
    setDeleting('feed_' + id)
    try { await remove(ref(db, `feed/${id}`)) } finally { setDeleting(null) }
  }

  async function deleteComment(matchId, commentId) {
    setDeleting(`mc_${matchId}_${commentId}`)
    try { await remove(ref(db, `match_comments/${matchId}/${commentId}`)) } finally { setDeleting(null) }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Feed global ({feedPosts.length})</h3>
      {feedPosts.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>Aucun message.</p>
      ) : (
        <div className="admin-mod-list" style={{ marginBottom: 32 }}>
          {feedPosts.map((p) => {
            const key = 'feed_' + p.id
            return (
              <div key={p.id} className="admin-mod-row">
                <AvatarDisplay avatar={p.avatar} size={28} />
                <div className="admin-mod-body">
                  <span className="admin-mod-name">{p.name}</span>
                  <span className="admin-mod-time">{fmt(p.createdAt)}</span>
                  <p className="admin-mod-text">{p.text}</p>
                </div>
                <button
                  className="admin-mod-del"
                  onClick={() => deleteFeed(p.id)}
                  disabled={deleting === key}
                >
                  {deleting === key ? '...' : '🗑'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Commentaires match ({matchComments.length})</h3>
      {matchComments.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aucun commentaire.</p>
      ) : (
        <div className="admin-mod-list">
          {matchComments.map((c) => {
            const key = `mc_${c.matchId}_${c.commentId}`
            return (
              <div key={key} className="admin-mod-row">
                <AvatarDisplay avatar={c.avatar} size={28} />
                <div className="admin-mod-body">
                  <span className="admin-mod-name">{c.name}</span>
                  <span className="admin-mod-match">{matchLabel(c.matchId)}</span>
                  <span className="admin-mod-time">{fmt(c.createdAt)}</span>
                  <p className="admin-mod-text">{c.text}</p>
                </div>
                <button
                  className="admin-mod-del"
                  onClick={() => deleteComment(c.matchId, c.commentId)}
                  disabled={deleting === key}
                >
                  {deleting === key ? '...' : '🗑'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DashboardTab() {
  const { players, allBets, challenges } = useApp()

  const totalPlayers = Object.keys(players).length
  const totalBets = useMemo(
    () => Object.values(allBets).reduce((sum, bets) => sum + Object.keys(bets).length, 0),
    [allBets]
  )
  const totalChallenges = Object.keys(challenges).length

  const stats = [
    { label: 'Joueurs', value: totalPlayers, icon: '👥' },
    { label: 'Paris', value: totalBets, icon: '🎯' },
    { label: 'Défis', value: totalChallenges, icon: '⚔️' },
  ]

  return (
    <div className="admin-dashboard">
      {stats.map(({ label, value, icon }) => (
        <div key={label} className="admin-stat-card">
          <span className="admin-stat-icon">{icon}</span>
          <span className="admin-stat-value">{value}</span>
          <span className="admin-stat-label">{label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminPage() {
  const { matches } = useApp()
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [adminPwd, setAdminPwd] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [activePhase, setActivePhase] = useState('group')
  const [adminTab, setAdminTab] = useState('results') // 'results' | 'players' | 'dashboard' | 'moderation'

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

      {/* Top-level tab switcher */}
      <div className="admin-main-tabs">
        <button
          className={`admin-main-tab ${adminTab === 'results' ? 'active' : ''}`}
          onClick={() => setAdminTab('results')}
        >
          ⚽ Résultats
        </button>
        <button
          className={`admin-main-tab ${adminTab === 'players' ? 'active' : ''}`}
          onClick={() => setAdminTab('players')}
        >
          👥 Joueurs
        </button>
        <button
          className={`admin-main-tab ${adminTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setAdminTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`admin-main-tab ${adminTab === 'moderation' ? 'active' : ''}`}
          onClick={() => setAdminTab('moderation')}
        >
          🛡 Modération
        </button>
      </div>

      {adminTab === 'dashboard' ? (
        <DashboardTab />
      ) : adminTab === 'players' ? (
        <PlayerManager />
      ) : adminTab === 'moderation' ? (
        <ModerationTab />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
