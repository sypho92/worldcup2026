import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeAllGroupStandings } from '../utils/standings'
import Flag from '../components/Flag'
import { AvatarDisplay } from '../components/AvatarDisplay'
import PlayerProfileModal from '../components/PlayerProfileModal'

const formatPlayerName = (name) => {
  const n = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  return n.length > 9 ? n.slice(0, 9) + '…' : n
}

const PHASES = [
  { key: 'group', label: 'Phase de groupes' },
  { key: 'r32', label: '32e de finale' },
  { key: 'r16', label: '16e de finale' },
  { key: 'qf', label: 'Quarts de finale' },
  { key: 'sf', label: 'Demi-finales' },
  { key: 'third', label: '3e place' },
  { key: 'final', label: 'Finale' },
]


function PerPhaseAccordion({ pseudoId }) {
  const [open, setOpen] = useState(false)
  const { allBets, results, matches } = useApp()

  const phaseStats = useMemo(() => {
    const playerBets = allBets[pseudoId] || {}
    return PHASES.map((p) => {
      const phaseMatches = matches.filter((m) => m.phase === p.key)
      let pts = 0, correct = 0
      phaseMatches.forEach((m) => {
        const r = results[m.id]
        const b = playerBets[m.id]
        if (r && b) {
          if (b === r.winner) { pts += 1; correct++ }
        }
      })
      const played = phaseMatches.filter((m) => results[m.id]).length
      return { ...p, pts, correct, played }
    }).filter((p) => p.played > 0)
  }, [allBets, pseudoId, results, matches])

  if (phaseStats.length === 0) return null

  return (
    <div style={{ marginTop: 6 }}>
      <button
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        Détails {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {phaseStats.map((p) => (
            <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
              <span>{p.label}</span>
              <span>{p.pts} pts ({p.correct}/{p.played})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GroupTable({ groupId, teams, groupMatches, results }) {
  const [open, setOpen] = useState(false)
  const { matches, groupsData } = useApp()
  const standings = useMemo(
    () => computeAllGroupStandings(groupsData, matches, results),
    [groupsData, matches, results]
  )
  const rows = standings[groupId] || []

  return (
    <div className="accordion">
      <div className="accordion-header" onClick={() => setOpen((o) => !o)}>
        <span>Groupe {groupId} — {teams.map((t) => t.name).join(', ')}</span>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="accordion-body">
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Équipe</th>
                <th>J</th>
                <th>G</th>
                <th>N</th>
                <th>P</th>
                <th>Bp</th>
                <th>Bc</th>
                <th>Diff</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.team.name} className={i < 2 ? 'qualified' : ''}>
                  <td>{i + 1}{row.requiresDrawingOfLots && <span className="lots">⚠</span>}</td>
                  <td>
                    <div className="team-cell">
                      <Flag flag={row.team.flag} size={16} />
                      <span>{row.team.name}</span>
                    </div>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.drawn}</td>
                  <td>{row.lost}</td>
                  <td>{row.gf}</td>
                  <td>{row.ga}</td>
                  <td>{row.gd > 0 ? '+' : ''}{row.gd}</td>
                  <td className="pts-cell">{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RankArrow({ delta }) {
  if (delta === null || delta === undefined) return null
  if (delta > 0) return <span style={{ color: '#22c55e', fontSize: 12, marginLeft: 3 }}>▲</span>
  if (delta < 0) return <span style={{ color: '#ef4444', fontSize: 12, marginLeft: 3 }}>▼</span>
  return <span style={{ color: 'var(--text-secondary)', fontSize: 12, marginLeft: 3 }}>–</span>
}

export default function ScoreboardPage() {
  const { player, scoreboard, results, matches, groupsData, scoreboardSnapshot } = useApp()
  const [showGroups, setShowGroups] = useState(false)
  const [viewedPlayerId, setViewedPlayerId] = useState(null)
  const [showInfo, setShowInfo] = useState(false)

  const board = useMemo(() => scoreboard(), [scoreboard])

  return (
    <div className="page">
      <h1 className="page-title">Classement</h1>

      <button className="sb-info-badge" onClick={() => setShowInfo(true)}>
        ℹ️ Informations sur le classement
      </button>

      {showInfo && (
        <div className="ppm-overlay" onClick={() => setShowInfo(false)}>
          <div className="sb-info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sb-info-modal-header">
              <span>ℹ️ Informations sur le classement</span>
              <button className="ppm-close" onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <p className="sb-info-desc">Tournoi entre amis / famille — pronostic simple.</p>
            <ul className="sb-info-list">
              <li>1 point par bon pronostic</li>
              <li>Quitte ou double : +2 pts pour le gagnant, 0 pour le perdant</li>
              <li>Possibilité de lancer des défis entre joueurs</li>
              <li>Ordre : plus de points = mieux classé — à égalité, le plus de matchs joués l'emporte</li>
            </ul>
            <p className="sb-info-thanks">Merci de participer ! 🎉</p>
          </div>
        </div>
      )}

      {viewedPlayerId && (
        <PlayerProfileModal
          playerId={viewedPlayerId}
          onClose={() => setViewedPlayerId(null)}
        />
      )}

      {/* League table */}
      <div className="lt-wrap mb-24">
        {board.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>Aucun joueur pour l'instant.</p>
          </div>
        ) : (
          <table className="lt-table">
            <thead>
              <tr className="lt-head">
                <th className="lt-col-rank">#</th>
                <th className="lt-col-player">Joueur</th>
                <th className="lt-col-stat lt-th-tip" data-tip="Paris joués">J</th>
                <th className="lt-col-stat lt-th-correct lt-th-tip" data-tip="Paris gagnés">G</th>
                <th className="lt-col-stat lt-th-wrong lt-th-tip" data-tip="Paris perdus">P</th>
                <th className="lt-col-pct lt-th-tip" data-tip="Taux de réussite">%</th>
                <th className="lt-col-pts lt-th-tip" data-tip="Points marqués">Pts</th>
              </tr>
            </thead>
            <tbody>
              {board.map((p, i) => {
                const played = p.correctBets + p.wrongBets
                const pct = played > 0 ? Math.round((p.correctBets / played) * 100) : 0
                const isMine = p.pseudoId === player?.pseudoId
                return (
                  <tr
                    key={p.pseudoId}
                    className={[
                      'lt-row',
                      isMine ? 'lt-row--mine' : '',
                      i === 0 ? 'lt-row--gold' : i === 1 ? 'lt-row--silver' : i === 2 ? 'lt-row--bronze' : ''
                    ].filter(Boolean).join(' ')}
                    onClick={() => setViewedPlayerId(p.pseudoId)}
                  >
                    <td className="lt-col-rank">
                      <span className={`lt-rank ${i < 3 ? 'lt-rank--top' : ''}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </span>
                    </td>
                    <td className="lt-col-player">
                      <RankArrow delta={scoreboardSnapshot[p.pseudoId] != null ? scoreboardSnapshot[p.pseudoId] - (i + 1) : null} />
                      <AvatarDisplay avatar={p.avatar} size={38} onClick={() => setViewedPlayerId(p.pseudoId)} />
                      <span className="lt-name">{formatPlayerName(p.name)}</span>
                    </td>
                    <td className="lt-col-stat lt-val">{played}</td>
                    <td className="lt-col-stat lt-val lt-val--correct">{p.correctBets}</td>
                    <td className="lt-col-stat lt-val lt-val--wrong">{p.wrongBets}</td>
                    <td className="lt-col-pct lt-val lt-val--pct">{pct}%</td>
                    <td className="lt-col-pts">
                      <span className="lt-pts">{p.points}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Group standings */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>Classements des groupes</div>
        <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => setShowGroups((o) => !o)}>
          {showGroups ? 'Masquer' : 'Afficher'}
        </button>
      </div>

      {showGroups && (
        <div>
          {Object.entries(groupsData).map(([gid, group]) => (
            <GroupTable
              key={gid}
              groupId={gid}
              teams={group.teams}
              groupMatches={matches.filter((m) => m.phase === 'group' && m.group === gid)}
              results={results}
            />
          ))}
        </div>
      )}
    </div>
  )
}
