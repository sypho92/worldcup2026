import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import { abbrev } from '../utils/format'

export default function ChallengeModal({ matchId, challengedId, onClose }) {
  const { player, players, sendChallenge, myBets, allBets, challenges, matchesById } = useApp()
  const [type, setType] = useState('double')
  const [gage, setGage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const match = matchesById[matchId]
  const challenged = players[challengedId]
  const myBet = myBets[matchId]
  const theirBet = allBets[challengedId]?.[matchId]

  // Check existing challenge
  const existingId1 = `${matchId}_${player?.pseudoId}_vs_${challengedId}`
  const existingId2 = `${matchId}_${challengedId}_vs_${player?.pseudoId}`
  const existing = challenges[existingId1] || challenges[existingId2]

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  async function handleSend() {
    if (type === 'gage' && !gage.trim()) return
    setSending(true)
    setError('')
    try {
      await sendChallenge({ matchId, challengedId, type, gage: gage.trim() })
      setSent(true)
      setTimeout(onClose, 1800)
    } catch (err) {
      setError('Erreur lors de l\'envoi. Vérifie ta connexion ou les règles Firebase (/challenges).')
    } finally {
      setSending(false)
    }
  }

  if (!match || !challenged) return null

  const myBetTeam =
    myBet === 'home' ? match.homeTeam
    : myBet === 'away' ? match.awayTeam
    : null
  const theirBetTeam =
    theirBet === 'home' ? match.homeTeam
    : theirBet === 'away' ? match.awayTeam
    : null

  const statusLabel = existing
    ? existing.status === 'pending' ? '⏳ Défi en attente'
    : existing.status === 'accepted' ? '⚔ Défi accepté'
    : null
    : null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card challenge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚔ Défi</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {sent ? (
          <div className="challenge-sent">
            <div className="challenge-sent-icon">⚔</div>
            <p className="challenge-sent-text">Défi envoyé à <strong>{challenged.name}</strong> !</p>
            <p className="challenge-sent-sub">Il recevra une notification.</p>
          </div>
        ) : existing && existing.status !== 'rejected' && existing.status !== 'cancelled' ? (
          <div className="challenge-existing">
            <div className="challenge-existing-icon">{existing.status === 'accepted' ? '⚔' : '⏳'}</div>
            <p className="challenge-existing-text">{statusLabel}</p>
            {existing.gage && (
              <div className="challenge-gage-display">
                <span className="challenge-gage-label">Gage :</span>
                <span className="challenge-gage-text">"{existing.gage}"</span>
              </div>
            )}
            <button className="btn-secondary" style={{ marginTop: 16 }} onClick={onClose}>Fermer</button>
          </div>
        ) : (
          <>
            {/* Opponent + match */}
            <div className="challenge-opponent">
              <AvatarDisplay avatar={challenged.avatar} size={44} />
              <div className="challenge-opponent-info">
                <span className="challenge-opponent-name">{challenged.name}</span>
                <span className="challenge-opponent-sub">
                  mise sur&nbsp;
                  {theirBetTeam ? (
                    <><Flag flag={theirBetTeam.flag} size={12} /> {abbrev(theirBetTeam)}</>
                  ) : 'Nul'}
                </span>
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

            {/* My bet vs their bet */}
            <div className="challenge-bets-row">
              <div className="challenge-bet-mine">
                <AvatarDisplay avatar={player?.avatar} size={20} />
                <span>{myBetTeam ? abbrev(myBetTeam) : 'Nul'}</span>
              </div>
              <span className="challenge-bets-sword">⚔</span>
              <div className="challenge-bet-theirs">
                <span>{theirBetTeam ? abbrev(theirBetTeam) : 'Nul'}</span>
                <AvatarDisplay avatar={challenged.avatar} size={20} />
              </div>
            </div>

            {/* Type selector */}
            <div className="challenge-type-row">
              <button
                className={`challenge-type-btn${type === 'double' ? ' active' : ''}`}
                onClick={() => setType('double')}
              >
                <span className="challenge-type-icon">🎯</span>
                <span className="challenge-type-name">Quitte ou double</span>
                <span className="challenge-type-desc">+1 pt pour le gagnant</span>
              </button>
              <button
                className={`challenge-type-btn${type === 'gage' ? ' active' : ''}`}
                onClick={() => setType('gage')}
              >
                <span className="challenge-type-icon">📝</span>
                <span className="challenge-type-name">Gage</span>
                <span className="challenge-type-desc">Le perdant paie</span>
              </button>
            </div>

            {type === 'gage' && (
              <div className="challenge-gage-wrap">
                <label className="form-label">Ton gage (max 100 car.)</label>
                <textarea
                  className="form-input challenge-gage-input"
                  value={gage}
                  onChange={(e) => setGage(e.target.value.slice(0, 100))}
                  placeholder="Ex : offrir une tournée, faire le tour du bureau en slip…"
                  rows={3}
                />
                <span className="challenge-gage-count">{gage.length}/100</span>
              </div>
            )}

            {error && <p className="challenge-send-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={onClose}>Annuler</button>
              <button
                className="btn-primary"
                onClick={handleSend}
                disabled={sending || (type === 'gage' && !gage.trim())}
              >
                {sending ? 'Envoi…' : '⚔ Envoyer'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
