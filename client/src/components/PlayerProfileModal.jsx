import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import ChallengeModal from './ChallengeModal'
import { abbrev } from '../utils/format'

const PHASES = [
  { key: 'group',  label: 'Phase de groupes' },
  { key: 'r32',   label: '32e de finale' },
  { key: 'r16',   label: '16e de finale' },
  { key: 'qf',    label: 'Quarts de finale' },
  { key: 'sf',    label: 'Demi-finales' },
  { key: 'third', label: '3e place' },
  { key: 'final', label: 'Finale' },
]

export default function PlayerProfileModal({ playerId, onClose }) {
  const { players, allBets, results, scoreboard, player: me, myBets, challenges, isMatchLocked, matches } = useApp()
  const [challengeMatchId, setChallengeMatchId] = useState(null)

  const player = players[playerId]
  const playerBets = allBets[playerId] || {}

  const board = useMemo(() => scoreboard(), [scoreboard])
  const rank = board.findIndex((p) => p.pseudoId === playerId) + 1
  const playerData = board.find((p) => p.pseudoId === playerId)

  const betCount = Object.keys(playerBets).length

  const phases = useMemo(() => {
    return PHASES.map((phase) => {
      const phaseMatches = matches.filter((m) => m.phase === phase.key && playerBets[m.id])
      return { ...phase, matches: phaseMatches }
    }).filter((p) => p.matches.length > 0)
  }, [playerBets])

  // Matches where me and this player have OPPOSITE bets (and match not finished)
  const oppositeMatches = useMemo(() => {
    if (!me || me.pseudoId === playerId) return []
    return matches.filter((m) => {
      const myBet = myBets[m.id]
      const theirBet = playerBets[m.id]
      if (!myBet || !theirBet) return false
      if (myBet === theirBet) return false
      if (results[m.id]) return false  // finished
      return true
    })
  }, [me, playerId, myBets, playerBets, results])

  if (!player) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card player-profile-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">{player.name}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Hero: avatar + stats */}
        <div className="ppm-hero">
          <div className="ppm-avatar">
            <AvatarDisplay avatar={player.avatar} size={64} />
          </div>
          <div className="ppm-stats">
            <div className="ppm-stat">
              <span className="ppm-val">{playerData?.points ?? 0}</span>
              <span className="ppm-lbl">pts</span>
            </div>
            <div className="ppm-div" />
            <div className="ppm-stat">
              <span className="ppm-val">{betCount}</span>
              <span className="ppm-lbl">paris</span>
            </div>
            <div className="ppm-div" />
            <div className="ppm-stat">
              <span className="ppm-val">{rank > 0 ? rank : '—'}</span>
              <span className="ppm-lbl">rang</span>
            </div>
          </div>
        </div>

        {/* Matchs opposés — invitation à défier */}
        {oppositeMatches.length > 0 && (
          <div className="ppm-oppositions">
            <div className="ppm-section-label">⚔ Paris opposés</div>
            {oppositeMatches.map((m) => {
              const myBet = myBets[m.id]
              const theirBet = playerBets[m.id]
              const myTeam = myBet === 'home' ? m.homeTeam : myBet === 'away' ? m.awayTeam : null
              const theirTeam = theirBet === 'home' ? m.homeTeam : theirBet === 'away' ? m.awayTeam : null
              const id1 = `${m.id}_${me.pseudoId}_vs_${playerId}`
              const id2 = `${m.id}_${playerId}_vs_${me.pseudoId}`
              const existing = challenges[id1] || challenges[id2]
              const locked = isMatchLocked(m)

              return (
                <div key={m.id} className="ppm-opposition-row">
                  <div className="ppm-opp-match">
                    <Flag flag={m.homeTeam.flag} size={13} />
                    <span>{abbrev(m.homeTeam.name)}</span>
                    <span className="ppm-opp-sep">–</span>
                    <span>{abbrev(m.awayTeam.name)}</span>
                    <Flag flag={m.awayTeam.flag} size={13} />
                  </div>
                  <div className="ppm-opp-bets">
                    <span className="ppm-opp-mine">{myTeam ? abbrev(myTeam.name) : 'Nul'}</span>
                    <span className="ppm-opp-sword">⚔</span>
                    <span className="ppm-opp-theirs">{theirTeam ? abbrev(theirTeam.name) : 'Nul'}</span>
                  </div>
                  {locked ? (
                    <span className="ppm-opp-locked">🔒 Live</span>
                  ) : existing && existing.status !== 'rejected' ? (
                    <span className={`ppm-opp-status ppm-opp-status--${existing.status}`}>
                      {existing.status === 'accepted' ? '⚔ Actif' : '⏳ En attente'}
                    </span>
                  ) : (
                    <button
                      className="ppm-opp-challenge-btn"
                      onClick={() => setChallengeMatchId(m.id)}
                    >
                      ⚔ Défier
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Bets list */}
        <div className="ppm-bets">
          {phases.length === 0 ? (
            <p className="ppm-empty">Aucun pari encore placé</p>
          ) : (
            phases.map((phase) => (
              <div key={phase.key} className="ppm-phase">
                <div className="ppm-phase-label">{phase.label}</div>
                {phase.matches.map((match) => {
                  const bet = playerBets[match.id]
                  const result = results[match.id]
                  const isCorrect = result && bet === result.winner
                  const isWrong = result && !isCorrect

                  const betTeam =
                    bet === 'home' ? match.homeTeam
                    : bet === 'away' ? match.awayTeam
                    : null

                  return (
                    <div
                      key={match.id}
                      className={`ppm-bet-row${isCorrect ? ' correct' : isWrong ? ' wrong' : ''}`}
                    >
                      {/* Équipes */}
                      <div className="ppm-bet-teams">
                        <Flag flag={match.homeTeam.flag} size={14} />
                        <span>{abbrev(match.homeTeam.name)}</span>
                        <span className="ppm-bet-vs">—</span>
                        <span>{abbrev(match.awayTeam.name)}</span>
                        <Flag flag={match.awayTeam.flag} size={14} />
                      </div>

                      {/* Pari choisi */}
                      <div className="ppm-bet-pick">
                        {bet === 'draw' ? (
                          <span className="ppm-bet-draw">Nul</span>
                        ) : betTeam ? (
                          <>
                            <Flag flag={betTeam.flag} size={14} />
                            <span>{abbrev(betTeam.name)}</span>
                          </>
                        ) : null}
                        {result && (
                          <span className={isCorrect ? 'ppm-ok' : 'ppm-bad'}>
                            {isCorrect ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

      </div>

      {challengeMatchId && (
        <ChallengeModal
          matchId={challengeMatchId}
          challengedId={playerId}
          onClose={() => setChallengeMatchId(null)}
        />
      )}
    </div>
  )
}
