import { useApp } from '../context/AppContext'
import { getPhaseLabel, getPhaseBadgeColor } from '../data/mockData'
import BetButtons from './BetButtons'
import Flag from './Flag'

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MatchCard({ match, showBets = true, showVenue = false }) {
  const { results, myBets } = useApp()

  const result = results[match.id]
  const bet = myBets[match.id]
  const finished = !!result

  let cardClass = 'match-card'
  if (finished && bet) {
    cardClass += bet === result.winner ? ' correct-border' : ' wrong-border'
  } else if (!finished && bet) {
    cardClass += ' bet-placed'
  }

  const badgeColor = getPhaseBadgeColor(match.phase)
  const phaseLabel = match.phase === 'group'
    ? `Groupe ${match.group} · J${match.matchday}`
    : getPhaseLabel(match.phase)

  return (
    <div className={cardClass}>
      <div className="match-header">
        <div className="match-meta">
          <span
            className="phase-badge"
            style={{ background: badgeColor + '22', color: badgeColor }}
          >
            {phaseLabel}
          </span>
          <span className="match-meta-date">{formatDate(match.date)} · {match.time}</span>
        </div>
        {finished && bet && (
          <span style={{ fontSize: 13, color: bet === result.winner ? 'var(--success)' : 'var(--error)' }}>
            {bet === result.winner ? '✓' : '✗'}
          </span>
        )}
      </div>

      <div className="match-teams">
        <div className="team">
          <Flag flag={match.homeTeam.flag} size={24} />
          <span className="team-name">{match.homeTeam.name}</span>
        </div>

        <div className="match-score">
          {finished ? (
            <span className="score-value">{result.homeScore} – {result.awayScore}</span>
          ) : (
            <span className="score-pending">VS</span>
          )}
          {showVenue && (
            <span className="score-venue">{match.venue.split(',')[0]}</span>
          )}
        </div>

        <div className="team">
          <Flag flag={match.awayTeam.flag} size={24} />
          <span className="team-name">{match.awayTeam.name}</span>
        </div>
      </div>

      {showBets && (
        <BetButtons match={match} />
      )}
    </div>
  )
}
