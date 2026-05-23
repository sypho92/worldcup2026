import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import { abbrev } from '../utils/format'

export default function ChallengeNotifications() {
  const { player, players, challenges, respondToChallenge, allBets, matchesById } = useApp()
  const [dismissed, setDismissed] = useState({})

  const pending = useMemo(() => {
    if (!player) return []
    return Object.entries(challenges)
      .filter(([id, c]) =>
        c.challengedId === player.pseudoId &&
        c.status === 'pending' &&
        !dismissed[id]
      )
      .map(([id, c]) => ({ id, ...c }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [challenges, player, dismissed])

  if (pending.length === 0) return null

  return (
    <div className="challenge-notifications">
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
                  {abbrev(match.homeTeam.name)} – {abbrev(match.awayTeam.name)}
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
                <><Flag flag={theirTeam.flag} size={12} /> <strong>{abbrev(theirTeam.name)}</strong></>
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
    </div>
  )
}
