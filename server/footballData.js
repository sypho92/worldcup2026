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

  return {
    id: matchId,
    fdId: apiMatch.id,
    utcDate: apiMatch.utcDate,
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
    result: winner !== null ? { homeScore, awayScore, winner } : null,
    goals: [],
    manualOverride: false,
  }
}

module.exports = { fetchMatches, mapMatch, normalizeWinner, STAGE_TO_PHASE }
