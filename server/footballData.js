const API_BASE = 'https://api.football-data.org/v4'

const STAGE_TO_PHASE = {
  GROUP_STAGE: 'group',
  ROUND_OF_32: 'r32',
  ROUND_OF_16: 'r16',
  QUARTER_FINALS: 'qf',
  SEMI_FINALS: 'sf',
  THIRD_PLACE: 'third',
  FINAL: 'final',
}

function getHeaders() {
  return { 'X-Auth-Token': process.env.FOOTBALL_DATA_API_KEY }
}

async function fetchMatches(competitionId, params = {}) {
  const query = new URLSearchParams(params).toString()
  const url = `${API_BASE}/competitions/${competitionId}/matches${query ? '?' + query : ''}`
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) throw new Error(`football-data ${res.status}: ${url}`)
  const data = await res.json()
  return data.matches || []
}

/** Détail complet d'un match (inclut les buteurs) */
async function fetchMatchDetail(fdId) {
  const url = `${API_BASE}/matches/${fdId}`
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) throw new Error(`football-data ${res.status}: ${url}`)
  return res.json()
}

function normalizeWinner(winner) {
  if (winner === 'HOME_TEAM') return 'home'
  if (winner === 'AWAY_TEAM') return 'away'
  if (winner === 'DRAW') return 'draw'
  return null
}

function mapMatch(apiMatch, matchId, phase) {
  const resolvedPhase = phase || STAGE_TO_PHASE[apiMatch.stage] || apiMatch.stage?.toLowerCase() || 'unknown'
  const group = apiMatch.group ? apiMatch.group.replace('GROUP_', '') : null

  const winner = normalizeWinner(apiMatch.score?.winner)
  const homeScore = apiMatch.score?.fullTime?.home ?? null
  const awayScore = apiMatch.score?.fullTime?.away ?? null

  // Calcul date/heure locale (Europe/Paris) depuis utcDate
  const d = new Date(apiMatch.utcDate)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })

  return {
    id: matchId,
    fdId: apiMatch.id,
    utcDate: apiMatch.utcDate,
    date,
    time,
    status: apiMatch.status,
    minute: apiMatch.minute ?? null,
    phase: resolvedPhase,
    group,
    matchday: apiMatch.matchday ?? null,
    venue: apiMatch.venue ?? null,
    homeTeam: {
      name: apiMatch.homeTeam.name,
      tla: apiMatch.homeTeam.tla || null,
      crest: apiMatch.homeTeam.crest || null,
    },
    awayTeam: {
      name: apiMatch.awayTeam.name,
      tla: apiMatch.awayTeam.tla || null,
      crest: apiMatch.awayTeam.crest || null,
    },
    score: {
      winner,
      duration: apiMatch.score?.duration || 'REGULAR',
      fullTime: { home: homeScore, away: awayScore },
      halfTime: {
        home: apiMatch.score?.halfTime?.home ?? null,
        away: apiMatch.score?.halfTime?.away ?? null,
      },
    },
    result: apiMatch.status === 'FINISHED' && winner !== null ? { homeScore, awayScore, winner } : null,
    goals: mapGoals(apiMatch.goals, apiMatch.homeTeam?.id, apiMatch.awayTeam?.id),
    manualOverride: false,
  }
}

/**
 * Normalise le tableau goals de l'API football-data.org.
 * side : 'home' | 'away' — indique quelle équipe bénéficie du but.
 * Pour les buts contre son camp le scorer appartient à l'équipe adverse,
 * mais team.id dans l'API représente l'équipe qui MARQUE (pas qui encaisse).
 */
function mapGoals(apiGoals, homeTeamId, awayTeamId) {
  if (!apiGoals || !Array.isArray(apiGoals)) return []
  return apiGoals
    .filter((g) => g && g.scorer)
    .map((g) => ({
      minute:      g.minute ?? null,
      minuteExtra: g.injuryTime ?? null,
      type:        g.type || 'REGULAR',           // REGULAR | OWN_GOAL | PENALTY
      scorer:      g.scorer?.shortName || g.scorer?.name || null,
      assist:      g.assist?.shortName  || g.assist?.name  || null,
      side:
        g.team?.id === homeTeamId ? 'home' :
        g.team?.id === awayTeamId ? 'away' : null,
    }))
}

module.exports = { fetchMatches, fetchMatchDetail, mapMatch, mapGoals, normalizeWinner, STAGE_TO_PHASE }
