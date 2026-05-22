import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { matches, getPointsForPhase } from '../data/mockData'
import ScheduleRow from '../components/ScheduleRow'

const PHASES = [
  { key: 'group', label: 'Phase de groupes' },
  { key: 'r32', label: 'Huitièmes de finale (32e)' },
  { key: 'r16', label: 'Huitièmes de finale' },
  { key: 'qf', label: 'Quarts de finale' },
  { key: 'sf', label: 'Demi-finales' },
  { key: 'third', label: 'Match pour la 3e place' },
  { key: 'final', label: 'Finale' },
]

function PhaseSection({ phaseKey, phaseLabel, phaseMatches }) {
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
            <ScheduleRow key={m.id} match={m} entryDelay={Math.min(i, 5) * 0.06} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MyBetsPage() {
  const { myBets } = useApp()
  const totalBets = Object.keys(myBets).length

  const matchesByPhase = useMemo(() => {
    const map = {}
    PHASES.forEach((p) => {
      const ms = matches.filter((m) => m.phase === p.key)
      if (ms.length > 0) map[p.key] = ms
    })
    return map
  }, [])

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
          />
        ) : null
      )}
    </div>
  )
}
