import { useApp } from '../context/AppContext'
import { isKnockout } from '../data/mockData'

export default function BetButtons({ match, compact = false }) {
  const { myBets, placeBet, results, isMatchLocked } = useApp()

  const result = results[match.id]
  const currentBet = myBets[match.id]
  const finished = !!result
  const locked = !finished && isMatchLocked(match)
  const blocked = finished || locked
  const knockout = isKnockout(match.phase)

  function getBtnClass(outcome) {
    if (blocked) {
      if (currentBet === outcome && finished) {
        return currentBet === result.winner ? 'bet-btn correct' : 'bet-btn wrong'
      }
      return currentBet === outcome ? 'bet-btn selected' : 'bet-btn'
    }
    return currentBet === outcome ? 'bet-btn selected' : 'bet-btn'
  }

  const homeLabel = compact ? '1' : match.homeTeam.name
  const awayLabel = compact ? '2' : match.awayTeam.name

  return (
    <div className="bet-buttons">
      <button
        className={getBtnClass('home')}
        onClick={() => !blocked && placeBet(match.id, 'home')}
        disabled={locked && currentBet !== 'home'}
      >
        {homeLabel}
      </button>
      {!knockout && (
        <button
          className={getBtnClass('draw')}
          onClick={() => !blocked && placeBet(match.id, 'draw')}
          disabled={locked && currentBet !== 'draw'}
        >
          Nul
        </button>
      )}
      <button
        className={getBtnClass('away')}
        onClick={() => !blocked && placeBet(match.id, 'away')}
        disabled={locked && currentBet !== 'away'}
      >
        {awayLabel}
      </button>
    </div>
  )
}
