const { db } = require('./firebase')
const { fetchMatches, normalizeWinner } = require('./footballData')

const COMPETITIONS = [
  { id: 2000, label: 'WC2026' },
  { id: 2001, label: 'CL' },
  { id: 2014, label: 'LIGA' },
]

const POLL_LIVE_MS = 2 * 60 * 1000
const POLL_IDLE_MS = 60 * 60 * 1000

let timer = null

async function buildFdIndex() {
  const snap = await db.ref('matches').get()
  const fdIndex = {}      // fdId → matchId
  const overrides = {}    // matchId → boolean

  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([matchId, m]) => {
      if (m.fdId) fdIndex[m.fdId] = matchId
      overrides[matchId] = m.manualOverride === true
    })
  }

  return { fdIndex, overrides }
}

function buildUpdates(apiMatch) {
  const winner = normalizeWinner(apiMatch.score?.winner)
  const homeScore = apiMatch.score?.fullTime?.home ?? null
  const awayScore = apiMatch.score?.fullTime?.away ?? null

  const updates = {
    status: apiMatch.status,
    minute: apiMatch.minute ?? null,
    'score/winner': winner,
    'score/duration': apiMatch.score?.duration || 'REGULAR',
    'score/fullTime/home': homeScore,
    'score/fullTime/away': awayScore,
    'score/halfTime/home': apiMatch.score?.halfTime?.home ?? null,
    'score/halfTime/away': apiMatch.score?.halfTime?.away ?? null,
  }

  if (apiMatch.status === 'FINISHED' && winner !== null) {
    updates.result = { homeScore, awayScore, winner }
  }

  return updates
}

async function syncCompetition(competitionId, fdIndex, overrides) {
  const apiMatches = await fetchMatches(competitionId)
  let hasLive = false

  for (const apiMatch of apiMatches) {
    const matchId = fdIndex[apiMatch.id]
    if (!matchId) continue

    if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED') hasLive = true

    if (overrides[matchId]) continue   // in-memory check, no Firebase read

    const updates = buildUpdates(apiMatch)
    await db.ref(`matches/${matchId}`).update(updates)
  }

  return hasLive
}

async function syncOnce(fdIndex, overrides) {
  let hasLive = false

  for (const comp of COMPETITIONS) {
    try {
      const live = await syncCompetition(comp.id, fdIndex, overrides)
      if (live) hasLive = true
    } catch (err) {
      console.error(`[sync] ${comp.label} error:`, err.message)
    }
  }

  return hasLive
}

async function loop(fdIndex, overrides) {
  try {
    const hasLive = await syncOnce(fdIndex, overrides)
    const delay = hasLive ? POLL_LIVE_MS : POLL_IDLE_MS
    console.log(`[sync] next poll in ${delay / 60000}min (live: ${hasLive})`)
    timer = setTimeout(() => loop(fdIndex, overrides), delay)
  } catch (err) {
    console.error('[sync] loop error:', err.message)
    timer = setTimeout(() => loop(fdIndex, overrides), POLL_IDLE_MS)
  }
}

async function startSync() {
  console.log('[sync] building fdId index...')
  const { fdIndex, overrides } = await buildFdIndex()
  console.log(`[sync] ${Object.keys(fdIndex).length} matches indexed`)
  loop(fdIndex, overrides)
}

module.exports = { startSync }
