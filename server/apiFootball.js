/**
 * Client API-Football (api-sports.io) — utilisé uniquement pour les buteurs.
 * Les scores/statuts restent gérés par football-data.org.
 *
 * Free tier : 100 req/jour — largement suffisant pour la CdM (max 4 matchs simultanés).
 */

const API_BASE = 'https://v3.football.api-sports.io'

function getHeaders() {
  return {
    'x-apisports-key': process.env.AFL_API_KEY,
  }
}

/**
 * Récupère tous les fixtures d'une date donnée (YYYY-MM-DD).
 * Coûte 1 requête — on cache le résultat pour la journée.
 */
async function fetchFixturesByDate(date) {
  const res = await fetch(`${API_BASE}/fixtures?date=${date}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`afl fixtures ${res.status}`)
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`afl error: ${JSON.stringify(data.errors)}`)
  }
  return data.response || []
}

/**
 * Parse un objet fixture brut de l'API en format interne normalisé.
 */
function parseFixture(f) {
  if (!f) return null
  const statusShort = f.fixture?.status?.short
  const elapsed     = f.fixture?.status?.elapsed ?? null
  const extra       = f.fixture?.status?.extra   ?? null

  let status = 'TIMED'
  if (statusShort === '1H' || statusShort === '2H' || statusShort === 'ET' || statusShort === 'P')
    status = 'IN_PLAY'
  else if (statusShort === 'HT')
    status = 'PAUSED'
  else if (statusShort === 'FT' || statusShort === 'AET' || statusShort === 'PEN')
    status = 'FINISHED'

  const homeScore = f.score?.fulltime?.home ?? f.goals?.home ?? null
  const awayScore = f.score?.fulltime?.away ?? f.goals?.away ?? null
  const winner =
    status === 'FINISHED' && homeScore !== null && awayScore !== null
      ? homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw'
      : null

  return { status, statusShort, elapsed, extra, homeScore, awayScore, winner }
}

/**
 * Récupère TOUS les fixtures live en un seul appel — remplace les appels par-match.
 * Coûte 1 requête quelle que soit le nombre de matchs en cours.
 */
async function fetchAllLiveFixtures() {
  const res = await fetch(`${API_BASE}/fixtures?live=all`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`afl live all ${res.status}`)
  const data = await res.json()
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(`afl error: ${JSON.stringify(data.errors)}`)
  }
  return data.response || []
}

/**
 * Récupère le statut d'un fixture spécifique (1 requête).
 * Uniquement utilisé quand un match vient de terminer (disparu du feed live).
 */
async function fetchFixtureLive(fixtureId) {
  const res = await fetch(`${API_BASE}/fixtures?id=${fixtureId}`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`afl fixture live ${res.status}`)
  const data = await res.json()
  return parseFixture((data.response || [])[0])
}

/**
 * Récupère les events (buts, cartons…) d'un fixture AFL.
 * Coûte 1 requête.
 */
async function fetchFixtureEvents(fixtureId) {
  const res = await fetch(`${API_BASE}/fixtures/events?fixture=${fixtureId}&type=Goal`, { headers: getHeaders() })
  if (!res.ok) throw new Error(`afl events ${res.status}`)
  const data = await res.json()
  return data.response || []
}

/**
 * Normalise un nom d'équipe pour la comparaison fuzzy.
 */
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // accents
    .replace(/[^a-z0-9]/g, '')                           // non-alphanum
}

/**
 * Essaie de faire correspondre un match football-data.org avec un fixture AFL.
 * Compare TLA + début du nom normalisé côté home ET away.
 */
function findAflFixture(aflFixtures, fdMatch) {
  const homeTla  = normalize(fdMatch.homeTeam?.tla)
  const homeName = normalize(fdMatch.homeTeam?.name)
  const awayTla  = normalize(fdMatch.awayTeam?.tla)
  const awayName = normalize(fdMatch.awayTeam?.name)

  return aflFixtures.find((f) => {
    const aflHome = normalize(f.teams?.home?.name)
    const aflAway = normalize(f.teams?.away?.name)

    const homeMatch =
      aflHome.includes(homeTla)  || homeTla.includes(aflHome.slice(0, 3)) ||
      aflHome.includes(homeName.slice(0, 5)) || homeName.includes(aflHome.slice(0, 5))

    const awayMatch =
      aflAway.includes(awayTla)  || awayTla.includes(aflAway.slice(0, 3)) ||
      aflAway.includes(awayName.slice(0, 5)) || awayName.includes(aflAway.slice(0, 5))

    return homeMatch && awayMatch
  }) || null
}

/**
 * Mappe les events AFL → format interne { minute, minuteExtra, type, scorer, assist, side }.
 * aflHomeTeamId / aflAwayTeamId : IDs équipes côté API-Football.
 */
function mapAflGoals(events, aflHomeTeamId, aflAwayTeamId) {
  return events
    .filter((e) => e.type === 'Goal' && e.detail !== 'Missed Penalty')
    .map((e) => ({
      minute:      e.time?.elapsed  ?? null,
      minuteExtra: e.time?.extra    ?? null,
      type:
        e.detail === 'Own Goal' ? 'OWN_GOAL'
        : e.detail === 'Penalty' ? 'PENALTY'
        : 'REGULAR',
      scorer: e.player?.name || null,
      assist: e.assist?.name || null,
      side:   e.team?.id === aflHomeTeamId ? 'home' : 'away',
    }))
}

module.exports = { fetchFixturesByDate, fetchFixtureLive, fetchAllLiveFixtures, parseFixture, fetchFixtureEvents, findAflFixture, mapAflGoals }
