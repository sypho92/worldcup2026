import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import { abbrev } from '../utils/format'

/**
 * Modal affiché quand l'adversaire demande l'annulation d'un défi.
 * challengeId : ID du challenge concerné
 * onClose     : ferme le modal
 */
export default function CancelRequestModal({ challengeId, onClose }) {
  const { player, players, challenges, matchesById, allBets, respondToCancelChallenge } = useApp()

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const challenge = challenges[challengeId]
  if (!challenge) return null

  const match = matchesById[challenge.matchId]
  const requesterId = challenge.cancelRequestedBy
  const requester = players[requesterId]
  const otherId = challenge.challengerId === player?.pseudoId ? challenge.challengedId : challenge.challengerId
  const other = players[otherId]

  if (!match || !requester) return null

  const myBet = allBets[player?.pseudoId]?.[challenge.matchId]
  const theirBet = allBets[otherId]?.[challenge.matchId]

  const getBetTeam = (bet) =>
    bet === 'home' ? match.homeTeam
    : bet === 'away' ? match.awayTeam
    : null

  const myBetTeam    = getBetTeam(myBet)
  const theirBetTeam = getBetTeam(theirBet)

  async function handleAccept() {
    await respondToCancelChallenge(challengeId, true)
    onClose()
  }

  async function handleRefuse() {
    await respondToCancelChallenge(challengeId, false)
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card challenge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🤝 Annulation de défi</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Demandeur */}
        <div className="challenge-opponent">
          <AvatarDisplay avatar={requester.avatar} size={44} />
          <div className="challenge-opponent-info">
            <span className="challenge-opponent-name">{requester.name}</span>
            <span className="challenge-opponent-sub">demande l'annulation du défi</span>
          </div>
        </div>

        {/* Match */}
        <div className="challenge-match-row">
          <Flag flag={match.homeTeam.flag} size={22} />
          <span className="challenge-match-abbr">{abbrev(match.homeTeam)}</span>
          <span className="challenge-match-sep">–</span>
          <span className="challenge-match-abbr">{abbrev(match.awayTeam)}</span>
          <Flag flag={match.awayTeam.flag} size={22} />
        </div>

        {/* Mes paris vs les leurs */}
        <div className="challenge-bets-row">
          <div className="challenge-bet-mine">
            <AvatarDisplay avatar={player?.avatar} size={20} />
            <span>{myBetTeam ? abbrev(myBetTeam) : myBet === 'draw' ? 'Nul' : '—'}</span>
          </div>
          <span className="challenge-bets-sword">⚔</span>
          <div className="challenge-bet-theirs">
            <span>{theirBetTeam ? abbrev(theirBetTeam) : theirBet === 'draw' ? 'Nul' : '—'}</span>
            <AvatarDisplay avatar={other?.avatar} size={20} />
          </div>
        </div>

        {/* Type + gage */}
        <div className="cancel-modal-type">
          {challenge.type === 'double' ? '🎯 Quitte ou double' : '📝 Gage'}
          {challenge.gage && (
            <div className="challenge-gage-display" style={{ marginTop: 8 }}>
              <span className="challenge-gage-label">Gage :</span>
              <span className="challenge-gage-text">"{challenge.gage}"</span>
            </div>
          )}
        </div>

        <p className="cancel-modal-info">
          Si tu acceptes, le défi est annulé et aucun des deux ne doit rien.
        </p>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={handleRefuse}>✗ Refuser</button>
          <button className="btn-primary" onClick={handleAccept}>✓ Accepter l'annulation</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
