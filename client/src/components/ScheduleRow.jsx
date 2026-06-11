import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { getPhaseLabel, isKnockout } from '../utils/format'
import Flag from './Flag'
import { AvatarDisplay } from './AvatarDisplay'
import PlayerProfileModal from './PlayerProfileModal'
import ChallengeModal from './ChallengeModal'
import WatchPartyButton from './WatchPartyButton'
import { abbrev } from '../utils/format'

export { abbrev }  // re-export so existing imports don't break

// ─── Buteurs ──────────────────────────────────────────────────────────────────
function GoalsList({ goals }) {
  if (!goals || !Array.isArray(goals) || goals.length === 0) return null

  const sorted = [...goals].sort((a, b) => {
    const ma = (a.minute ?? 999) * 10 + (a.minuteExtra ?? 0)
    const mb = (b.minute ?? 999) * 10 + (b.minuteExtra ?? 0)
    return ma - mb
  })

  return (
    <div className="sched-goals">
      <div className="sched-goals-header">⚽ Buteurs</div>
      {sorted.map((g, i) => {
        const isHome     = g.side === 'home'
        const isOG       = g.type === 'OWN_GOAL'
        const isPen      = g.type === 'PENALTY'
        const minLabel   = g.minuteExtra ? `${g.minute}+${g.minuteExtra}'` : `${g.minute ?? '?'}'`
        const scorerText = [g.scorer || '?', isOG && '(csc)', isPen && '(p.)'].filter(Boolean).join(' ')
        const icon       = isOG ? '🏳️' : '⚽'

        return (
          <div key={i} className={`sched-goal-line${isOG ? ' sched-goal-line--og' : ''}`}>
            <span className="sched-goal-home">
              {isHome && <>{scorerText}&nbsp;<span className="sched-goal-ball">{icon}</span></>}
            </span>
            <span className="sched-goal-min">{minLabel}</span>
            <span className="sched-goal-away">
              {!isHome && <><span className="sched-goal-ball">{icon}</span>&nbsp;{scorerText}</>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const MAX_VISIBLE = 3

function BettorsModal({ label, bettors, onClose, onPlayerClick }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card bettors-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Paris — {label}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bettors-list">
          {bettors.map((p) => (
            <div
              key={p.pseudoId}
              className="bettors-list-row"
              onClick={() => { onClose(); onPlayerClick(p.pseudoId) }}
            >
              <AvatarDisplay avatar={p.avatar} size={36} />
              <span className="bettors-list-name">{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function ChallengeableModal({ bettors, onClose, onChallengeClick }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card bettors-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚔ Qui défier ?</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="bettors-list">
          {bettors.map((p) => (
            <div key={p.pseudoId} className="bettors-list-row bettors-list-row--challenge">
              <AvatarDisplay avatar={p.avatar} size={36} />
              <span className="bettors-list-name">{p.name}</span>
              <button
                className="bet-bar-duel-btn"
                style={{ marginLeft: 'auto', flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); onClose(); onChallengeClick(p.pseudoId) }}
              >
                ⚔ Défier
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

function BetBar({ match, onPlayerClick, onChallengeClick }) {
  const { allBets, players, myBets, player, challenges, results } = useApp()
  const [bettorsModal, setBettorsModal] = useState(null)
  const [challengeModal, setChallengeModal] = useState(null)
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
          {homeBettors.slice(0, MAX_VISIBLE).map((p, i) => (
            <AvatarBtn key={i} p={p} />
          ))}
          {homeBettors.length > MAX_VISIBLE && (
            <button
              className="bet-bar-avatar bet-bar-avatar-more-btn"
              onClick={(e) => { e.stopPropagation(); setBettorsModal({ label: abbrev(match.homeTeam), bettors: homeBettors }) }}
            >
              +{homeBettors.length - MAX_VISIBLE}
            </button>
          )}
        </div>
        {!knockout && drawBettors.length > 0 && (
          <div className="bet-bar-avatars-draw">
            {drawBettors.slice(0, MAX_VISIBLE).map((p, i) => (
              <AvatarBtn key={i} p={p} />
            ))}
            {drawBettors.length > MAX_VISIBLE && (
              <button
                className="bet-bar-avatar bet-bar-avatar-more-btn"
                onClick={(e) => { e.stopPropagation(); setBettorsModal({ label: 'Nul', bettors: drawBettors }) }}
              >
                +{drawBettors.length - MAX_VISIBLE}
              </button>
            )}
          </div>
        )}
        <div className="bet-bar-avatars-away">
          {awayBettors.slice(0, MAX_VISIBLE).map((p, i) => (
            <AvatarBtn key={i} p={p} />
          ))}
          {awayBettors.length > MAX_VISIBLE && (
            <button
              className="bet-bar-avatar bet-bar-avatar-more-btn"
              onClick={(e) => { e.stopPropagation(); setBettorsModal({ label: abbrev(match.awayTeam), bettors: awayBettors }) }}
            >
              +{awayBettors.length - MAX_VISIBLE}
            </button>
          )}
        </div>
      </div>

      <div className="bet-bar-labels">
        <span className="bet-bar-side bet-bar-side--home">
          <Flag flag={match.homeTeam.flag} size={12} />
          {abbrev(match.homeTeam)} <strong>{pHome}%</strong>
        </span>
        {!knockout && pDraw > 0 && (
          <span className="bet-bar-side bet-bar-side--draw">Nul {pDraw}%</span>
        )}
        <span className="bet-bar-side bet-bar-side--away">
          <strong>{pAway}%</strong> {abbrev(match.awayTeam)}
          <Flag flag={match.awayTeam.flag} size={12} />
        </span>
      </div>
      <div className="bet-bar-track">
        {pHome > 0 && <div className="bet-bar-fill bet-bar-fill--home" style={{ width: `${pHome}%` }} />}
        {pDraw > 0 && <div className="bet-bar-fill bet-bar-fill--draw" style={{ width: `${pDraw}%` }} />}
        {pAway > 0 && <div className="bet-bar-fill bet-bar-fill--away" style={{ width: `${pAway}%` }} />}
      </div>

      {bettorsModal && (
        <BettorsModal
          label={bettorsModal.label}
          bettors={bettorsModal.bettors}
          onClose={() => setBettorsModal(null)}
          onPlayerClick={onPlayerClick}
        />
      )}
      {challengeModal && (
        <ChallengeableModal
          bettors={challengeModal}
          onClose={() => setChallengeModal(null)}
          onChallengeClick={onChallengeClick}
        />
      )}

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
          return !ex || ex.status === 'rejected' || ex.status === 'cancelled'
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
              <button
                className="bet-bar-duel-btn bet-bar-duel-btn--more"
                onClick={(e) => { e.stopPropagation(); setChallengeModal(challengeable) }}
              >
                +{challengeable.length - 3}
              </button>
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
  const { results, myBets, placeBet, isMatchLocked, challenges, players, player, requestCancelChallenge, respondToCancelChallenge } = useApp()
  const [viewedPlayerId, setViewedPlayerId] = useState(null)
  const [challengedId, setChallengedId] = useState(null)
  const [animatingBtn, setAnimatingBtn] = useState(null)
  const [expanded, setExpanded] = useState(false)

  function handleBet(outcome) {
    placeBet(match.id, outcome)
    setAnimatingBtn(outcome)
  }

  const result = results[match.id]
  const bet = myBets[match.id]
  const finished = !!result
  const locked = !finished && isMatchLocked(match)
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const knockout = isKnockout(match.phase)

  // Défis qui verrouillent ce match pour le joueur courant
  const lockingChallenges = useMemo(() => {
    if (!player || !locked) return []
    return Object.entries(challenges)
      .filter(([, c]) =>
        c.matchId === match.id &&
        (c.status === 'accepted' || c.status === 'cancel_requested') &&
        (c.challengerId === player.pseudoId || c.challengedId === player.pseudoId)
      )
      .map(([id, c]) => {
        const otherId = c.challengerId === player.pseudoId ? c.challengedId : c.challengerId
        return { id, ...c, opponent: players[otherId] }
      })
  }, [player, locked, challenges, players, match.id])

  const challengeLocked = locked && lockingChallenges.length > 0

  // Chrono estimé — se rafraîchit toutes les 30s quand le match est en cours
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [isLive])

  const displayMinute = useMemo(() => {
    if (!isLive) return null
    if (!match.utcDate) return null

    // 2ème mi-temps — coup d'envoi exact enregistré par le serveur (PAUSED → IN_PLAY)
    if (match.secondHalfKickoff) {
      const elapsed2 = Math.max(0, Math.floor((now - match.secondHalfKickoff) / 60000))
      return Math.min(90, 45 + elapsed2)
    }

    // Calcul depuis l'horloge client :
    //   1. firstHalfKickoff = timestamp enregistré par le serveur à la première détection IN_PLAY
    //      → précision ±1 min (intervalle de sync) — indépendant du délai API
    //   2. fallback : utcDate (heure officielle programmée) — peut dériver si le match
    //      commence en avance / en retard par rapport à l'heure officielle
    const kickoffMs = match.firstHalfKickoff || new Date(match.utcDate).getTime()
    const elapsed   = Math.max(0, Math.floor((now - kickoffMs) / 60000))

    // Mi-temps API confirmée ET < 63 min écoulées → vrai mi-temps
    if (match.status === 'PAUSED' && elapsed <= 63) return null

    // 2ème mi-temps estimée (pas de secondHalfKickoff encore) : > 63 min depuis le coup d'envoi
    // (45 min 1ère mi-temps + ~18 min de pause = ~63 min)
    if (elapsed > 63) return Math.min(90, Math.max(46, elapsed - 18))

    // 1ère mi-temps — calculé en temps réel
    return Math.min(45, Math.max(1, elapsed))
  }, [isLive, match.status, match.utcDate, match.firstHalfKickoff, match.secondHalfKickoff, now])

  // Score en direct depuis l'API
  const liveHome = match.score?.fullTime?.home ?? match.score?.halfTime?.home ?? null
  const liveAway = match.score?.fullTime?.away ?? match.score?.halfTime?.away ?? null
  const hasLiveScore = isLive && liveHome !== null && liveAway !== null

  const phaseLabel =
    match.phase === 'group'
      ? `Groupe ${match.group} · J${match.matchday}`
      : getPhaseLabel(match.phase)

  let rowClass = 'sched-row'
  if (finished && bet) rowClass += bet === result.winner ? ' sched-row--correct' : ' sched-row--wrong'
  else if (finished && !bet) rowClass += ' sched-row--unbet'
  else if (bet) rowClass += ' sched-row--bet'          // gold même si verrouillé par défi
  else if (challengeLocked) rowClass += ' sched-row--challenge-locked'
  else if (locked) rowClass += ' sched-row--locked'

  function getBtnState(outcome) {
    if (bet === outcome) return 'selected'
    return ''
  }

  return (
    <div className={rowClass} style={{ '--card-delay': `${entryDelay}s` }}>

      {/* Badge statut : heure / minute live / Mi-temps / Terminé */}
      {finished ? (
        <div className="sched-time-badge sched-time-badge--score">
          <span className="sched-badge-status">Terminé</span>
        </div>
      ) : isLive && displayMinute === null ? (
        // Mi-temps confirmée ET client estime qu'elle n'est pas encore terminée
        <div className="sched-time-badge sched-time-badge--live">
          <span className="sched-badge-status sched-badge-status--paused">Mi-temps</span>
        </div>
      ) : isLive ? (
        // En cours ou PAUSED mais >63 min écoulées → on estime que la 2e mi-temps a repris
        <div className="sched-time-badge sched-time-badge--live">
          <span className="sched-badge-status sched-badge-status--live">
            {`${displayMinute}'`}
          </span>
        </div>
      ) : !locked ? (
        <div className="sched-time-badge">{match.time ?? '--:--'}</div>
      ) : null}

      <div className="sched-main">

        {/* Centre : équipes + score entre les drapeaux */}
        <div className="sched-teams">
          <span className="sched-name">{abbrev(match.homeTeam)}</span>
          <Flag flag={match.homeTeam.flag} size={40} />

          {finished ? (
            <span className="sched-score">{result.homeScore} – {result.awayScore}</span>
          ) : hasLiveScore ? (
            <span className="sched-score sched-score--live">{liveHome} – {liveAway}</span>
          ) : (
            !locked && <span className="sched-sep">/</span>
          )}

          <Flag flag={match.awayTeam.flag} size={40} />
          <span className="sched-name">{abbrev(match.awayTeam)}</span>
        </div>

        {/* Droite : vide (résultat déplacé en bandeau bas) */}
        <div className="sched-right" />

      </div>

      {/* Phase — juste au-dessus du divider */}
      <div className="sched-phase-row">
        <span className="sched-phase-badge">{phaseLabel}</span>
      </div>

      {/* Bandeau défi — même structure que sched-result-banner, en jaune */}
      {challengeLocked && lockingChallenges.map((c) => {
        const isPending = c.status === 'cancel_requested'
        const iRequested = isPending && c.cancelRequestedBy === player?.pseudoId
        const opponentRequested = isPending && !iRequested
        const label = iRequested
          ? `Annulation en attente · ${c.opponent?.name?.split(' ')[0]}`
          : opponentRequested
          ? `${c.opponent?.name?.split(' ')[0]} demande l'annulation`
          : `Défi en cours · ${c.opponent?.name?.split(' ')[0]}`
        return (
          <div
            key={c.id}
            className={[
              'sched-challenge-lock',
              iRequested ? 'sched-challenge-lock--pending' : '',
              opponentRequested ? 'sched-challenge-lock--incoming' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="sched-challenge-lock-icon">
              {iRequested ? '⏳' : opponentRequested ? '⚠' : '⚔'}
            </span>
            <span className="sched-challenge-lock-text">{label}</span>

            {/* Défi actif → bouton annuler */}
            {!isPending && (
              <button
                className="sched-challenge-lock-cancel-btn"
                onClick={(e) => { e.stopPropagation(); requestCancelChallenge(c.id) }}
              >
                Annuler le défi
              </button>
            )}

            {/* L'adversaire a demandé → Refuser / Accepter */}
            {opponentRequested && (
              <div className="sched-challenge-lock-actions">
                <button
                  className="sched-challenge-lock-refuse-btn"
                  onClick={(e) => { e.stopPropagation(); respondToCancelChallenge(c.id, false) }}
                >
                  ✗ Refuser
                </button>
                <button
                  className="sched-challenge-lock-accept-btn"
                  onClick={(e) => { e.stopPropagation(); respondToCancelChallenge(c.id, true) }}
                >
                  ✓ Accepter
                </button>
              </div>
            )}
          </div>
        )
      })}

      {/* Bandeau résultat — toujours visible en bas pour les matchs terminés */}
      {finished && bet && (
        <div className={`sched-result-banner ${bet === result.winner ? 'sched-result-banner--correct' : 'sched-result-banner--wrong'}`}>
          <span className="sched-result-banner-icon">{bet === result.winner ? '✓' : '✗'}</span>
          <span className="sched-result-banner-text">
            {bet === result.winner ? 'Pronostic correct' : 'Pronostic manqué'}
          </span>
        </div>
      )}
      {finished && !bet && (
        <div className="sched-result-banner sched-result-banner--unbet">
          <span className="sched-result-banner-icon">—</span>
          <span className="sched-result-banner-text">Non pronostiqué</span>
        </div>
      )}

      {/* Buteurs — toujours visibles pour les matchs en cours */}
      {isLive && <GoalsList goals={match.goals} />}

      {/* Toggle déploiement — bouton AVANT le contenu pour que ça s'ouvre vers le bas */}
      {finished && (
        <button
          className={`sched-expand-btn ${expanded ? 'sched-expand-btn--open' : ''}`}
          onClick={() => setExpanded(e => !e)}
        >
          <span className="sched-expand-label">
            {expanded ? 'Masquer les détails' : 'Voir les détails'}
          </span>
          <span className="sched-expand-chevron">{expanded ? '▲' : '▼'}</span>
        </button>
      )}

      {/* BetBar + buteurs :
            - match à venir → toujours visible (pas de buts)
            - match en cours → BetBar visible, buteurs déjà affichés au-dessus
            - match terminé → déployable en dessous du bouton */}
      {(!finished || expanded) && (
        <>
          {finished && <GoalsList goals={match.goals} />}
          <BetBar match={match} onPlayerClick={setViewedPlayerId} onChallengeClick={setChallengedId} />
        </>
      )}

      {!finished && !locked && <WatchPartyButton match={match} label />}

      {!finished && !locked && (
        <div className="sched-bet-row">
          <button
            className={`sched-bet-btn sched-bet-btn--home ${getBtnState('home')} ${animatingBtn === 'home' ? 'sched-bet-btn--animating' : ''}`}
            onClick={() => handleBet('home')}
            onAnimationEnd={() => setAnimatingBtn(null)}
          >
            <Flag flag={match.homeTeam.flag} size={28} /> {abbrev(match.homeTeam)}
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
            <Flag flag={match.awayTeam.flag} size={28} /> {abbrev(match.awayTeam)}
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
