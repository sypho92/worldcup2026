import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { isKnockout } from '../utils/format'
import Flag from './Flag'
import { AvatarDisplay } from './AvatarDisplay'
import { abbrev } from '../utils/format'

export default function QuickBetModal({ matchId, onClose, highlightPlayer }) {
  const { results, myBets, placeBet, isMatchLocked, allBets, players, player, matchesById } = useApp()
  const [animating, setAnimating] = useState(null)

  const match = matchesById[matchId]

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  if (!match) return null

  const result = results[matchId]
  const bet = myBets[matchId]
  const finished = !!result
  const locked = !finished && isMatchLocked(match)
  const knockout = isKnockout(match.phase)

  // Who bet what on this match
  const homeBettors = []
  const drawBettors = []
  const awayBettors = []
  Object.entries(allBets).forEach(([pId, bets]) => {
    const b = bets[matchId]
    const p = players[pId]
    if (!b || !p) return
    const entry = { ...p, pseudoId: pId }
    if (b === 'home') homeBettors.push(entry)
    else if (b === 'draw') drawBettors.push(entry)
    else if (b === 'away') awayBettors.push(entry)
  })
  const totalBettors = homeBettors.length + drawBettors.length + awayBettors.length

  function handleBet(outcome) {
    placeBet(matchId, outcome)
    setAnimating(outcome)
    setTimeout(onClose, 500)
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card quick-bet-modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="modal-title">⚽ Parier</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Match display */}
        <div className="qb-match">
          <div className="qb-teams">
            <div className="qb-team">
              <Flag flag={match.homeTeam.flag} size={40} />
              <span className="qb-team-name">{abbrev(match.homeTeam)}</span>
            </div>
            <span className="qb-sep">
              {finished ? `${result.homeScore} – ${result.awayScore}` : `${match.time}`}
            </span>
            <div className="qb-team qb-team--away">
              <span className="qb-team-name">{abbrev(match.awayTeam)}</span>
              <Flag flag={match.awayTeam.flag} size={40} />
            </div>
          </div>
          <div className="qb-meta">{match.date} · {match.homeTeam.name} vs {match.awayTeam.name}</div>
        </div>

        {/* Who has already bet */}
        {totalBettors > 0 && (
          <div className="qb-bettor-strip">
            <div className="qb-bettor-group">
              {homeBettors.slice(0, 5).map((p) => (
                <span
                  key={p.pseudoId}
                  className={`qb-bettor-av${highlightPlayer === p.pseudoId ? ' highlighted' : ''}`}
                  title={`${p.name} → ${abbrev(match.homeTeam)}`}
                >
                  <AvatarDisplay avatar={p.avatar} size={28} />
                </span>
              ))}
              {homeBettors.length > 5 && <span className="qb-bettor-more">+{homeBettors.length - 5}</span>}
            </div>

            <div className="qb-bettor-sep">
              {!knockout && drawBettors.length > 0 && (
                <div className="qb-bettor-draw">
                  {drawBettors.slice(0, 3).map((p) => (
                    <span key={p.pseudoId} className="qb-bettor-av" title={`${p.name} → Nul`}>
                      <AvatarDisplay avatar={p.avatar} size={22} />
                    </span>
                  ))}
                  <span className="qb-bettor-draw-label">nul</span>
                </div>
              )}
            </div>

            <div className="qb-bettor-group qb-bettor-group--right">
              {awayBettors.length > 5 && <span className="qb-bettor-more">+{awayBettors.length - 5}</span>}
              {awayBettors.slice(0, 5).map((p) => (
                <span
                  key={p.pseudoId}
                  className={`qb-bettor-av${highlightPlayer === p.pseudoId ? ' highlighted' : ''}`}
                  title={`${p.name} → ${abbrev(match.awayTeam)}`}
                >
                  <AvatarDisplay avatar={p.avatar} size={28} />
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Current user's bet / action */}
        {finished ? (
          <div className="qb-state">
            <span className="qb-score-final">{result.homeScore} – {result.awayScore}</span>
            {bet && (
              <span className={`qb-result-badge ${bet === result.winner ? 'correct' : 'wrong'}`}>
                {bet === result.winner ? '✓ Pari correct' : '✗ Pari raté'}
              </span>
            )}
          </div>
        ) : locked ? (
          <div className="qb-state qb-state--locked">
            <div className="qb-live-dot" />
            <span>Match en cours — paris fermés</span>
          </div>
        ) : (
          <>
            {bet && (
              <div className="qb-current-bet">
                Ton pari actuel :{' '}
                <strong>
                  {bet === 'home' ? abbrev(match.homeTeam)
                    : bet === 'away' ? abbrev(match.awayTeam)
                    : 'Nul'}
                </strong>
                <span className="qb-current-bet-hint"> (cliquer pour changer)</span>
              </div>
            )}
            <div className="qb-btns">
              <button
                className={`qb-btn qb-btn--home${bet === 'home' ? ' selected' : ''}${animating === 'home' ? ' animating' : ''}`}
                onClick={() => handleBet('home')}
              >
                <Flag flag={match.homeTeam.flag} size={26} />
                <span>{abbrev(match.homeTeam)}</span>
              </button>
              {!knockout && (
                <button
                  className={`qb-btn qb-btn--draw${bet === 'draw' ? ' selected' : ''}${animating === 'draw' ? ' animating' : ''}`}
                  onClick={() => handleBet('draw')}
                >
                  Nul
                </button>
              )}
              <button
                className={`qb-btn qb-btn--away${bet === 'away' ? ' selected' : ''}${animating === 'away' ? ' animating' : ''}`}
                onClick={() => handleBet('away')}
              >
                <Flag flag={match.awayTeam.flag} size={26} />
                <span>{abbrev(match.awayTeam)}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
