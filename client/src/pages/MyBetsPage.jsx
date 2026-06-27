import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { getPointsForPhase } from '../utils/format'
import ScheduleRow from '../components/ScheduleRow'

const PHASES = [
  { key: 'group', label: 'Phase de groupes' },
  { key: 'r32', label: 'Seizièmes de finale' },
  { key: 'r16', label: 'Huitièmes de finale' },
  { key: 'qf', label: 'Quarts de finale' },
  { key: 'sf', label: 'Demi-finales' },
  { key: 'third', label: 'Match pour la 3e place' },
  { key: 'final', label: 'Finale' },
]

function PhaseSection({ phaseKey, phaseLabel, phaseMatches, nextMatchId }) {
  const [open, setOpen] = useState(true)
  const { myBets } = useApp()

  const betCount = phaseMatches.filter((m) => myBets[m.id]).length
  const pts = getPointsForPhase(phaseKey)

  return (
    <div style={{ marginBottom: 8 }}>
      <div className="mybets-phase-header" onClick={() => setOpen((o) => !o)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h3 className="mybets-phase-label">{phaseLabel}</h3>
          <span className="mybets-phase-pts">+{pts}pt{pts > 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="collapsible-count">{betCount}/{phaseMatches.length}</span>
          <span className={`collapsible-arrow ${open ? 'open' : ''}`}>▼</span>
        </div>
      </div>

      {open && (
        <div className="sched-day">
          {phaseMatches.map((m, i) => (
            <ScheduleRow key={m.id} match={m} entryDelay={Math.min(i, 5) * 0.06} isNextMatch={m.id === nextMatchId} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MyBetsPage() {
  const { myBets, matches, results } = useApp()
  const totalBets = Object.keys(myBets).length

  const matchesByPhase = useMemo(() => {
    const map = {}
    PHASES.forEach((p) => {
      const ms = matches.filter((m) => m.phase === p.key)
      if (ms.length > 0) map[p.key] = ms
    })
    return map
  }, [matches])

  const nextMatchId = useMemo(() => {
    const upcoming = matches
      .filter((m) => !results[m.id] && m.utcDate)
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
    return upcoming[0]?.id ?? null
  }, [matches, results])

  return (
    <div className="page sched-page">
      <div className="mybets-top">
        <h1 className="page-title" style={{ margin: 0 }}>Mes paris</h1>
        <span className="mybets-total">{totalBets}/{matches.length}</span>
      </div>

      {PHASES.map((p) =>
        matchesByPhase[p.key] ? (
          <PhaseSection
            key={p.key}
            phaseKey={p.key}
            phaseLabel={p.label}
            phaseMatches={matchesByPhase[p.key]}
            nextMatchId={nextMatchId}
          />
        ) : null
      )}
    </div>
  )
}
