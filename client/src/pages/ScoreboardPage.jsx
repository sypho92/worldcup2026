import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computeAllGroupStandings } from '../utils/standings'
import Flag from '../components/Flag'
import { AvatarDisplay } from '../components/AvatarDisplay'
import PlayerProfileModal from '../components/PlayerProfileModal'

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

export default function ScoreboardPage() {
  const { player, scoreboard, results, matches, groupsData } = useApp()
  const [showGroups, setShowGroups] = useState(false)
  const [viewedPlayerId, setViewedPlayerId] = useState(null)

  const board = useMemo(() => scoreboard(), [scoreboard])

  return (
    <div className="page">
      <h1 className="page-title">Classement</h1>

      {viewedPlayerId && (
        <PlayerProfileModal
          playerId={viewedPlayerId}
          onClose={() => setViewedPlayerId(null)}
        />
      )}

      {/* Player scoreboard */}
      <div className="scoreboard-list mb-24">
        {board.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🏆</div>
            <p>Aucun joueur pour l'instant.</p>
          </div>
        ) : (
          board.map((p, i) => (
            <div
              key={p.pseudoId}
              className={`scoreboard-row ${p.pseudoId === player?.pseudoId ? 'mine' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setViewedPlayerId(p.pseudoId)}
            >
              <span className={`rank ${i < 3 ? 'top' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <AvatarDisplay avatar={p.avatar} size={32} />
              <div className="player-info">
                <div className="name">{p.name}</div>
                <div className="sub">{p.correctBets} bon{p.correctBets !== 1 ? 's' : ''} pronostic{p.correctBets !== 1 ? 's' : ''}</div>
                <PerPhaseAccordion pseudoId={p.pseudoId} />
              </div>
              <span className="player-points">{p.points}</span>
            </div>
          ))
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
