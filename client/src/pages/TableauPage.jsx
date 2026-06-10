import { useState, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { computeGroupStandings } from '../utils/standings'
import Flag from '../components/Flag'

// ─── Couleurs distinctes par groupe ───────────────────────────────────────────
const GROUP_COLORS = {
  A: '#e74c3c', B: '#3498db', C: '#2ecc71', D: '#f0b429',
  E: '#9b59b6', F: '#1abc9c', G: '#e67e22', H: '#2980b9',
  I: '#27ae60', J: '#8e44ad', K: '#16a085', L: '#c0392b',
}

// Abrège les noms TBD pour le bracket
function shortName(name) {
  if (!name) return '?'
  return name
    .replace('1er Groupe ', '1er ')
    .replace('2e Groupe ', '2e ')
    .replace('3e #', '#')
    .replace('Vainqueur HB', 'HB')
    .replace('Vainqueur 1/8 ', '1/8 ')
    .replace('Vainqueur QF ', 'QF')
    .replace('Vainqueur SF ', 'SF')
    .replace('Perdant SF ', 'SF-')
    .replace('Vainqueur ', '')
    .replace('Perdant ', 'Per.')
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLET GROUPES
// ─────────────────────────────────────────────────────────────────────────────

function GroupCard({ groupId, group, selected, onClick }) {
  const { results, myBets, matches } = useApp()
  const color = GROUP_COLORS[groupId]
  const groupMatches = useMemo(
    () => matches.filter((m) => m.phase === 'group' && m.group === groupId),
    [groupId, matches]
  )
  const played = groupMatches.filter((m) => results[m.id]).length
  const betCount = groupMatches.filter((m) => myBets[m.id]).length

  return (
    <div
      className="group-card"
      onClick={onClick}
      style={{
        borderColor: selected ? color : color + '70',
        background: selected ? color + '22' : color + '0e',
      }}
    >
      <div
        className="group-card-header"
        style={{ borderBottom: `1px solid ${color}33` }}
      >
        <span className="group-card-letter" style={{ color }}>Groupe {groupId}</span>
        <span className="group-card-stats">{betCount}/6 paris · {played} joués</span>
      </div>
      <div className="group-card-teams">
        {group.teams.map((t) => (
          <div key={t.name} className="group-card-team">
            <Flag flag={t.flag} size={24} />
            <span>{t.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupDetail({ groupId, onClose }) {
  const { results, matches, groupsData } = useApp()
  const group = groupsData[groupId]
  const color = GROUP_COLORS[groupId]

  const groupMatches = useMemo(
    () => matches.filter((m) => m.phase === 'group' && m.group === groupId),
    [groupId, matches]
  )
  const standings = useMemo(
    () => group ? computeGroupStandings(group.teams, groupMatches, results) : [],
    [group, groupMatches, results]
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 480, borderTop: `3px solid ${color}` }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title" style={{ color }}>Groupe {groupId}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Équipe</th>
                <th>J</th><th>G</th><th>N</th><th>P</th>
                <th>Bp</th><th>Bc</th><th>Diff</th><th>Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => (
                <tr key={row.team.name} className={i < 2 ? 'qualified' : ''}>
                  <td>
                    {i + 1}
                    {row.requiresDrawingOfLots && <span className="lots" title="Tirage requis"> ⚠</span>}
                  </td>
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
                  <td style={{ color: row.gd > 0 ? 'var(--success)' : row.gd < 0 ? 'var(--error)' : '' }}>
                    {row.gd > 0 ? '+' : ''}{row.gd}
                  </td>
                  <td className="pts-cell">{row.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function GroupsTab() {
  const [selected, setSelected] = useState(null)
  const { groupsData } = useApp()

  return (
    <div>
      <div className="groups-grid">
        {Object.entries(groupsData).map(([gid, group]) => (
          <GroupCard
            key={gid}
            groupId={gid}
            group={group}
            selected={selected === gid}
            onClick={() => setSelected(selected === gid ? null : gid)}
          />
        ))}
      </div>
      {selected && <GroupDetail groupId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLET ÉLIMINATOIRES — BRACKET
// ─────────────────────────────────────────────────────────────────────────────

const LEFT = {
  r32: [['m073', 'm074'], ['m075', 'm076'], ['m077', 'm078'], ['m079', 'm080']],
  r16: ['m089', 'm090', 'm091', 'm092'],
  qf: ['m097', 'm098'],
  sf: 'm101',
}
const RIGHT = {
  qf: ['m099', 'm100'],
  r16: ['m093', 'm094', 'm095', 'm096'],
  r32: [['m081', 'm082'], ['m083', 'm084'], ['m085', 'm086'], ['m087', 'm088']],
  sf: 'm102',
}
const FINAL_ID = 'm104'
const THIRD_ID = 'm103'

function BracketSlot({ matchId, isFinal }) {
  const { results, myBets, matchesById } = useApp()
  const match = matchesById[matchId]
  if (!match) return null

  const result = results[matchId]
  const bet = myBets[matchId]

  let borderColor = 'var(--border)'
  if (result && bet) borderColor = bet === result.winner ? 'var(--success)' : 'var(--error)'
  else if (bet) borderColor = 'var(--accent)'

  const homeName = shortName(match.homeTeam?.name)
  const awayName = shortName(match.awayTeam?.name)

  return (
    <div className={`b-slot${isFinal ? ' b-slot--final' : ''}`} style={{ borderColor }}>
      <div className="b-slot-row">
        <Flag flag={match.homeTeam?.flag} size={14} />
        <span className="b-slot-name">{homeName}</span>
        {result && <span className="b-slot-score">{result.homeScore}</span>}
      </div>
      <div className="b-slot-div" />
      <div className="b-slot-row">
        <Flag flag={match.awayTeam?.flag} size={14} />
        <span className="b-slot-name">{awayName}</span>
        {result && <span className="b-slot-score">{result.awayScore}</span>}
      </div>
    </div>
  )
}

function ColR32({ pairs }) {
  return (
    <div className="b-col b-col--r32">
      {pairs.map(([a, b], i) => (
        <div className="b-pair" key={i}>
          <BracketSlot matchId={a} />
          <div className="b-pair-vline" />
          <BracketSlot matchId={b} />
        </div>
      ))}
    </div>
  )
}

function ColSingle({ ids, nSlots }) {
  return (
    <div className="b-col b-col--single" style={{ '--n': nSlots }}>
      {ids.map((id) => (
        <div className="b-single" key={id}>
          <BracketSlot matchId={id} />
        </div>
      ))}
    </div>
  )
}

function ColSF({ matchId }) {
  return (
    <div className="b-col b-col--sf">
      <BracketSlot matchId={matchId} />
    </div>
  )
}

function BracketView() {
  return (
    <div className="bracket-scroll">
      <div className="b-tree">

        {/* ── DEMI-GAUCHE : R32 → R16 → QF → SF1 ── */}
        <div className="b-half">
          <div className="b-col-wrap">
            <div className="b-col-label">32e de finale</div>
            <ColR32 pairs={LEFT.r32} />
          </div>
          <div className="b-col-wrap">
            <div className="b-col-label">16e de finale</div>
            <ColSingle ids={LEFT.r16} nSlots={8} />
          </div>
          <div className="b-col-wrap">
            <div className="b-col-label">Quarts</div>
            <ColSingle ids={LEFT.qf} nSlots={4} />
          </div>
          <div className="b-col-wrap b-col-wrap--sf">
            <div className="b-col-label">Demi-finales</div>
            <ColSF matchId={LEFT.sf} />
          </div>
        </div>

        {/* ── CENTRE : Finale + 3e place ── */}
        <div className="b-center">
          <div className="b-center-label">🏆 FINALE</div>
          <BracketSlot matchId={FINAL_ID} isFinal />
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <div className="b-center-label" style={{ color: 'var(--text-muted)', fontSize: 10 }}>3e PLACE</div>
            <BracketSlot matchId={THIRD_ID} />
          </div>
        </div>

        {/* ── DEMI-DROITE : SF2 → QF → R16 → R32 ── */}
        <div className="b-half b-half--right">
          <div className="b-col-wrap b-col-wrap--sf">
            <div className="b-col-label">Demi-finales</div>
            <ColSF matchId={RIGHT.sf} />
          </div>
          <div className="b-col-wrap">
            <div className="b-col-label">Quarts</div>
            <ColSingle ids={RIGHT.qf} nSlots={4} />
          </div>
          <div className="b-col-wrap">
            <div className="b-col-label">16e de finale</div>
            <ColSingle ids={RIGHT.r16} nSlots={8} />
          </div>
          <div className="b-col-wrap">
            <div className="b-col-label">32e de finale</div>
            <ColR32 pairs={RIGHT.r32} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ONGLET ÉLIMINATOIRES — VUE LISTE
// ─────────────────────────────────────────────────────────────────────────────

const KNOCKOUT_ROUNDS = [
  { key: 'r32', label: '32e', pts: 1 },
  { key: 'r16', label: '16e', pts: 1 },
  { key: 'qf', label: 'Quarts', pts: 1 },
  { key: 'sf', label: 'Demies', pts: 1 },
  { key: 'third', label: '3e place', pts: 1 },
  { key: 'final', label: 'Finale', pts: 1 },
]

function KnockoutTab() {
  const [view, setView] = useState('bracket')
  const [listRound, setListRound] = useState('r32')

  const { matches } = useApp()
  const listMatches = useMemo(
    () => matches.filter((m) => m.phase === listRound),
    [listRound, matches]
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className={`filter-tab ${view === 'bracket' ? 'active' : ''}`} onClick={() => setView('bracket')}>
          🏆 Bracket
        </button>
        <button className={`filter-tab ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>
          📋 Liste
        </button>
      </div>

      {view === 'bracket' ? (
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Faites défiler horizontalement pour voir l'arbre complet
          </p>
          <BracketView />
        </div>
      ) : (
        <div>
          <div className="filter-tabs">
            {KNOCKOUT_ROUNDS.map((r) => (
              <button
                key={r.key}
                className={`filter-tab ${listRound === r.key ? 'active' : ''}`}
                onClick={() => setListRound(r.key)}
              >
                {r.label}
                <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>+{r.pts}pts</span>
              </button>
            ))}
          </div>
          <div className="knockout-grid" style={{ marginTop: 16 }}>
            {listMatches.length === 0
              ? <div className="empty-state"><p>Aucun match.</p></div>
              : listMatches.map((m) => <MatchCard key={m.id} match={m} showBets showVenue />)
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export default function TableauPage() {
  const [tab, setTab] = useState('groups')

  return (
    <div className="page" style={{ maxWidth: '100%' }}>
      <h1 className="page-title">Tableau</h1>

      <div className="tableau-tabs">
        <button className={`tableau-tab ${tab === 'groups' ? 'active' : ''}`} onClick={() => setTab('groups')}>
          🌍 Groupes
        </button>
        <button className={`tableau-tab ${tab === 'knockout' ? 'active' : ''}`} onClick={() => setTab('knockout')}>
          ⚡ Phases éliminatoires
        </button>
      </div>

      {tab === 'groups' ? <GroupsTab /> : <KnockoutTab />}
    </div>
  )
}
