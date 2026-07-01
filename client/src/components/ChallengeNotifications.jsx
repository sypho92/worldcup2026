import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import { abbrev } from '../utils/format'
import CancelRequestModal from './CancelRequestModal'

export default function ChallengeNotifications() {
  const { player, players, challenges, respondToChallenge, allBets, matchesById, results } = useApp()
  const [dismissed, setDismissed] = useState({})
  const [cancelModalId, setCancelModalId] = useState(null)

  // Un défi n'est acceptable que si le match n'a pas encore commencé
  const isMatchOpen = (matchId) => {
    const m = matchesById[matchId]
    if (!m) return false
    if (results[matchId]) return false
    if (m.utcDate && Date.now() >= new Date(m.utcDate).getTime()) return false
    return true
  }

  // ── Nouveaux défis reçus ──────────────────────────────────────────────────
  const pending = useMemo(() => {
    if (!player) return []
    return Object.entries(challenges)
      .filter(([id, c]) =>
        c.challengedId === player.pseudoId &&
        c.status === 'pending' &&
        !dismissed[id] &&
        isMatchOpen(c.matchId)   // masque les défis dont le match a commencé
      )
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [challenges, player, dismissed, matchesById, results])

  // ── Demandes d'annulation reçues ──────────────────────────────────────────
  const cancelRequests = useMemo(() => {
    if (!player) return []
    return Object.entries(challenges)
      .filter(([id, c]) =>
        c.status === 'cancel_requested' &&
        c.cancelRequestedBy !== player.pseudoId &&
        (c.challengerId === player.pseudoId || c.challengedId === player.pseudoId) &&
        !dismissed[`cancel_${id}`] &&
        matchesById[c.matchId] &&
        players[c.cancelRequestedBy]
      )
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => (b.cancelRequestedAt || b.createdAt) - (a.cancelRequestedAt || a.createdAt))
  }, [challenges, player, dismissed, matchesById, players])

  if (pending.length === 0 && cancelRequests.length === 0) return null

  return (
    <>
      <div className="challenge-notifications">

        {/* ── Défis reçus ── */}
        {pending.map((challenge) => {
          const match = matchesById[challenge.matchId]
          const challenger = players[challenge.challengerId]
          const theirBet = allBets[challenge.challengerId]?.[challenge.matchId]
          const theirTeam =
            theirBet === 'home' ? match?.homeTeam
            : theirBet === 'away' ? match?.awayTeam
            : null

          if (!match || !challenger) return null

          return (
            <div key={challenge.id} className="challenge-notif">
              <button
                className="challenge-notif-dismiss"
                onClick={() => setDismissed((d) => ({ ...d, [challenge.id]: true }))}
              >✕</button>

              <div className="challenge-notif-header">
                <AvatarDisplay avatar={challenger.avatar} size={32} />
                <div className="challenge-notif-info">
                  <span className="challenge-notif-name">{challenger.name}</span>
                  <span className="challenge-notif-sub">
                    te défie sur{' '}
                    <Flag flag={match.homeTeam.flag} size={11} />
                    {abbrev(match.homeTeam)} – {abbrev(match.awayTeam)}
                    <Flag flag={match.awayTeam.flag} size={11} />
                  </span>
                </div>
                <span className="challenge-notif-type-badge">
                  {challenge.type === 'double' ? '🎯 +1pt' : '📝 Gage'}
                </span>
              </div>

              {challenge.gage && (
                <div className="challenge-notif-gage">
                  Gage : <em>"{challenge.gage}"</em>
                </div>
              )}

              <div className="challenge-notif-their-bet">
                Il mise sur :{' '}
                {theirTeam ? (
                  <><Flag flag={theirTeam.flag} size={12} /> <strong>{abbrev(theirTeam)}</strong></>
                ) : <strong>Nul</strong>}
              </div>

              <div className="challenge-notif-actions">
                <button
                  className="challenge-notif-reject-btn"
                  onClick={() => respondToChallenge(challenge.id, 'rejected')}
                >
                  ✗ Refuser
                </button>
                <button
                  className="challenge-notif-accept-btn"
                  onClick={() => respondToChallenge(challenge.id, 'accepted')}
                >
                  ⚔ Accepter
                </button>
              </div>
            </div>
          )
        })}

        {/* ── Demandes d'annulation reçues ── */}
        {cancelRequests.map((challenge) => {
          const match = matchesById[challenge.matchId]
          const requester = players[challenge.cancelRequestedBy]
          if (!match || !requester) return null

          return (
            <div key={`cancel_${challenge.id}`} className="challenge-notif challenge-notif--cancel">
              <button
                className="challenge-notif-dismiss"
                onClick={() => setDismissed((d) => ({ ...d, [`cancel_${challenge.id}`]: true }))}
              >✕</button>

              <div className="challenge-notif-header">
                <AvatarDisplay avatar={requester.avatar} size={32} />
                <div className="challenge-notif-info">
                  <span className="challenge-notif-name">{requester.name}</span>
                  <span className="challenge-notif-sub">
                    veut annuler le défi sur{' '}
                    <Flag flag={match.homeTeam.flag} size={11} />
                    {abbrev(match.homeTeam)} – {abbrev(match.awayTeam)}
                    <Flag flag={match.awayTeam.flag} size={11} />
                  </span>
                </div>
                <span className="challenge-notif-type-badge challenge-notif-type-badge--cancel">
                  🤝 Annulation
                </span>
              </div>

              {challenge.gage && (
                <div className="challenge-notif-gage">
                  Gage en jeu : <em>"{challenge.gage}"</em>
                </div>
              )}

              <div className="challenge-notif-actions">
                <button
                  className="challenge-notif-reject-btn"
                  onClick={() => setCancelModalId(challenge.id)}
                >
                  Voir les détails
                </button>
                <button
                  className="challenge-notif-accept-btn"
                  onClick={() => setCancelModalId(challenge.id)}
                >
                  🤝 Répondre
                </button>
              </div>
            </div>
          )
        })}

      </div>

      {/* Modal d'annulation */}
      {cancelModalId && (
        <CancelRequestModal
          challengeId={cancelModalId}
          onClose={() => {
            setCancelModalId(null)
            setDismissed((d) => ({ ...d, [`cancel_${cancelModalId}`]: true }))
          }}
        />
      )}
    </>
  )
}
