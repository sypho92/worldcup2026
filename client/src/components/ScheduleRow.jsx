import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { getPhaseLabel, isKnockout } from '../utils/format'
import Flag from './Flag'
import { AvatarDisplay } from './AvatarDisplay'
import PlayerProfileModal from './PlayerProfileModal'
import ChallengeModal from './ChallengeModal'
import { abbrev } from '../utils/format'

export { abbrev }  // re-export so existing imports don't break

const MAX_AVATARS = 5

function BetBar({ match, onPlayerClick, onChallengeClick }) {
  const { allBets, players, myBets, player, challenges, results } = useApp()
  const knockout = isKnockout(match.phase)
  const finished = !!results[match.id]
  const myBet = myBets[match.id]

  const homeBettors = []
  const drawBettors = []
  const awayBettors = []

  Object.entries(allBets).forEach(([pseudoId, pb]) => {
    const b = pb[match.id]
    const p = players[pseudoId]
    if (!p) return
    const entry = { ...p, pseudoId }
    if (b === 'home') homeBettors.push(entry)
    else if (b === 'draw' && !knockout) drawBettors.push(entry)
    else if (b === 'away') awayBettors.push(entry)
  })

  const total = homeBettors.length + drawBettors.length + awayBettors.length
  if (total === 0) return null

  const pHome = Math.round((homeBettors.length / total) * 100)
  const pDraw = knockout ? 0 : Math.round((drawBettors.length / total) * 100)
  const pAway = 100 - pHome - pDraw

  const AvatarBtn = ({ p }) => (
    <span
      className="bet-bar-avatar"
      title={p.name}
      style={{ cursor: 'pointer' }}
      onClick={(e) => { e.stopPropagation(); onPlayerClick(p.pseudoId) }}
    >
      <AvatarDisplay avatar={p.avatar} size={40} />
    </span>
  )

  return (
    <div className="bet-bar">
      <div className="bet-bar-avatars">
        <div className="bet-bar-avatars-home">
          {homeBettors.slice(0, MAX_AVATARS).map((p, i) => (
            <AvatarBtn key={i} p={p} />
          ))}
          {homeBettors.length > MAX_AVATARS && (
            <span className="bet-bar-avatar-more">+{homeBettors.length - MAX_AVATARS}</span>
          )}
        </div>
        {!knockout && drawBettors.length > 0 && (
          <div className="bet-bar-avatars-draw">
            {drawBettors.slice(0, 3).map((p, i) => (
              <AvatarBtn key={i} p={p} />
            ))}
          </div>
        )}
        <div className="bet-bar-avatars-away">
          {awayBettors.length > MAX_AVATARS && (
            <span className="bet-bar-avatar-more">+{awayBettors.length - MAX_AVATARS}</span>
          )}
          {awayBettors.slice(0, MAX_AVATARS).map((p, i) => (
            <AvatarBtn key={i} p={p} />
          ))}
        </div>
      </div>

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

      {/* Challenge pills — opponents on this match */}
      {!finished && myBet && player && onChallengeClick && (() => {
        const opponents =
          myBet === 'home' ? awayBettors
          : myBet === 'away' ? homeBettors
          : [...homeBettors, ...awayBettors]

        const challengeable = opponents.filter((p) => {
          const id1 = `${match.id}_${player.pseudoId}_vs_${p.pseudoId}`
          const id2 = `${match.id}_${p.pseudoId}_vs_${player.pseudoId}`
          const ex = challenges[id1] || challenges[id2]
          return !ex || ex.status === 'rejected'
        })
        const pending = opponents.filter((p) => {
          const id1 = `${match.id}_${player.pseudoId}_vs_${p.pseudoId}`
          const id2 = `${match.id}_${p.pseudoId}_vs_${player.pseudoId}`
          const ex = challenges[id1] || challenges[id2]
          return ex && ex.status === 'pending'
        })
        const accepted = opponents.filter((p) => {
          const id1 = `${match.id}_${player.pseudoId}_vs_${p.pseudoId}`
          const id2 = `${match.id}_${p.pseudoId}_vs_${player.pseudoId}`
          const ex = challenges[id1] || challenges[id2]
          return ex && ex.status === 'accepted'
        })

        if (challengeable.length === 0 && pending.length === 0 && accepted.length === 0) return null

        return (
          <div className="bet-bar-duels">
            {challengeable.slice(0, 3).map((p) => (
              <button
                key={p.pseudoId}
                className="bet-bar-duel-btn"
                onClick={(e) => { e.stopPropagation(); onChallengeClick(p.pseudoId) }}
                title={`Défier ${p.name}`}
              >
                <AvatarDisplay avatar={p.avatar} size={16} />
                <span>⚔ {p.name.split(' ')[0]}</span>
              </button>
            ))}
            {challengeable.length > 3 && (
              <span className="bet-bar-duel-more">+{challengeable.length - 3}</span>
            )}
            {pending.map((p) => (
              <button
                key={p.pseudoId}
                className="bet-bar-duel-btn bet-bar-duel-btn--pending"
                onClick={(e) => { e.stopPropagation(); onChallengeClick(p.pseudoId) }}
                title={`Défi en attente — ${p.name}`}
              >
                <AvatarDisplay avatar={p.avatar} size={16} />
                <span>⏳ {p.name.split(' ')[0]}</span>
              </button>
            ))}
            {accepted.map((p) => (
              <button
                key={p.pseudoId}
                className="bet-bar-duel-btn bet-bar-duel-btn--active"
                onClick={(e) => { e.stopPropagation(); onChallengeClick(p.pseudoId) }}
                title={`Défi actif — ${p.name}`}
              >
                <AvatarDisplay avatar={p.avatar} size={16} />
                <span>⚔ {p.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )
      })()}
    </div>
  )
}

export default function ScheduleRow({ match, entryDelay = 0 }) {
  const { results, myBets, placeBet, isMatchLocked } = useApp()
  const [viewedPlayerId, setViewedPlayerId] = useState(null)
  const [challengedId, setChallengedId] = useState(null)
  const [animatingBtn, setAnimatingBtn] = useState(null)

  function handleBet(outcome) {
    placeBet(match.id, outcome)
    setAnimatingBtn(outcome)
  }

  const result = results[match.id]
  const bet = myBets[match.id]
  const finished = !!result
  const locked = !finished && isMatchLocked(match)
  const knockout = isKnockout(match.phase)

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
    <div className={rowClass} style={{ '--card-delay': `${entryDelay}s` }}>

      <div className="sched-time-badge">{match.time}</div>

      <div className="sched-main">

        {/* Centre : équipes */}
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

        {/* Droite : résultat / LIVE */}
        <div className="sched-right">
          {finished && bet && (
            <span className={`sched-result-icon ${bet === result.winner ? 'correct' : 'wrong'}`}>
              {bet === result.winner ? '✓' : '✗'}
            </span>
          )}
          {locked && (
            <div className="sched-live-badge">
              <span className="sched-live-dot" />
              Live
            </div>
          )}
        </div>

      </div>

      {/* Phase — juste au-dessus du divider */}
      <div className="sched-phase-row">
        <span className="sched-phase-badge">{phaseLabel}</span>
      </div>

      <BetBar match={match} onPlayerClick={setViewedPlayerId} onChallengeClick={setChallengedId} />

      {!finished && !locked && (
        <div className="sched-bet-row">
          <button
            className={`sched-bet-btn sched-bet-btn--home ${getBtnState('home')} ${animatingBtn === 'home' ? 'sched-bet-btn--animating' : ''}`}
            onClick={() => handleBet('home')}
            onAnimationEnd={() => setAnimatingBtn(null)}
          >
            <Flag flag={match.homeTeam.flag} size={28} /> {abbrev(match.homeTeam.name)}
          </button>
          {!knockout && (
            <button
              className={`sched-bet-btn sched-bet-btn--draw ${getBtnState('draw')} ${animatingBtn === 'draw' ? 'sched-bet-btn--animating' : ''}`}
              onClick={() => handleBet('draw')}
              onAnimationEnd={() => setAnimatingBtn(null)}
            >
              Nul
            </button>
          )}
          <button
            className={`sched-bet-btn sched-bet-btn--away ${getBtnState('away')} ${animatingBtn === 'away' ? 'sched-bet-btn--animating' : ''}`}
            onClick={() => handleBet('away')}
            onAnimationEnd={() => setAnimatingBtn(null)}
          >
            <Flag flag={match.awayTeam.flag} size={28} /> {abbrev(match.awayTeam.name)}
          </button>
        </div>
      )}

      {viewedPlayerId && createPortal(
        <PlayerProfileModal
          playerId={viewedPlayerId}
          onClose={() => setViewedPlayerId(null)}
        />,
        document.body
      )}
      {challengedId && (
        <ChallengeModal
          matchId={match.id}
          challengedId={challengedId}
          onClose={() => setChallengedId(null)}
        />
      )}
    </div>
  )
}
