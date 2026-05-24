const { db } = require('./firebase')
const { fetchMatches, normalizeWinner } = require('./footballData')

const COMPETITIONS = [
  { id: 2000, label: 'WC2026', params: { season: '2026' } },
]

const POLL_LIVE_MS  = 1 * 60 * 1000   // 1 min when live or kickoff imminent
const POLL_IDLE_MS  = 60 * 60 * 1000  // 60 min max idle
const PREMATCH_LEAD = 5 * 60 * 1000   // wake up 5 min before kickoff

let timer = null

async function buildFdIndex() {
  const snap = await db.ref('matches').get()
  const fdIndex = {}      // fdId → matchId

  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([matchId, m]) => {
      if (m.fdId) fdIndex[m.fdId] = matchId
    })
  }

  return fdIndex
}

// Returns overrides, previous statuses, and nearest upcoming kickoff
async function refreshMatchState() {
  const snap = await db.ref('matches').get()
  const overrides = {}
  const prevStatuses = {}   // matchId → last known status
  let nearestKickoffMs = Infinity
  const now = Date.now()

  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([matchId, m]) => {
      overrides[matchId] = m.manualOverride === true
      prevStatuses[matchId] = m.status || null

      if (m.utcDate && !m.result) {
        const ts = new Date(m.utcDate).getTime()
        if (ts > now && ts < nearestKickoffMs) nearestKickoffMs = ts
      }
    })
  }

  return { overrides, prevStatuses, nearestKickoffMs }
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

async function syncCompetition(competitionId, fdIndex, overrides, prevStatuses, params = {}) {
  const apiMatches = await fetchMatches(competitionId, params)
  let hasLive = false

  for (const apiMatch of apiMatches) {
    const matchId = fdIndex[apiMatch.id]
    if (!matchId) continue

    if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED') hasLive = true

    if (overrides[matchId]) continue

    const updates = buildUpdates(apiMatch)

    // Enregistre l'heure exacte du coup d'envoi de la 2ème mi-temps
    // quand le statut passe de PAUSED → IN_PLAY
    if (apiMatch.status === 'IN_PLAY' && prevStatuses[matchId] === 'PAUSED') {
      updates.secondHalfKickoff = Date.now()
      console.log(`[sync] 2nd half kickoff recorded for ${matchId}`)
    }

    await db.ref(`matches/${matchId}`).update(updates)
  }

  return hasLive
}

async function syncOnce(fdIndex) {
  const { overrides, prevStatuses, nearestKickoffMs } = await refreshMatchState()
  let hasLive = false

  for (const comp of COMPETITIONS) {
    try {
      const live = await syncCompetition(comp.id, fdIndex, overrides, prevStatuses, comp.params || {})
      if (live) hasLive = true
    } catch (err) {
      console.error(`[sync] ${comp.label} error:`, err.message)
    }
  }

  return { hasLive, nearestKickoffMs }
}

// Smart delay: 1 min if live or kickoff imminent, otherwise sleep until 5 min before next kickoff
function computeDelay(hasLive, nearestKickoffMs) {
  if (hasLive) return POLL_LIVE_MS

  const now = Date.now()
  if (nearestKickoffMs === Infinity) return POLL_IDLE_MS

  const msUntil = nearestKickoffMs - now

  if (msUntil <= PREMATCH_LEAD + POLL_LIVE_MS) return POLL_LIVE_MS
  return Math.min(msUntil - PREMATCH_LEAD, POLL_IDLE_MS)
}

async function loop(fdIndex) {
  try {
    const { hasLive, nearestKickoffMs } = await syncOnce(fdIndex)
    const delay = computeDelay(hasLive, nearestKickoffMs)

    const delayMin = (delay / 60000).toFixed(1)
    const kickoffInfo = nearestKickoffMs !== Infinity
      ? `next kickoff in ${((nearestKickoffMs - Date.now()) / 60000).toFixed(0)}min`
      : 'no upcoming matches'
    console.log(`[sync] next poll in ${delayMin}min (live: ${hasLive}, ${kickoffInfo})`)

    timer = setTimeout(() => loop(fdIndex), delay)
  } catch (err) {
    console.error('[sync] loop error:', err.message)
    timer = setTimeout(() => loop(fdIndex), POLL_IDLE_MS)
  }
}

async function startSync() {
  console.log('[sync] building fdId index...')
  _fdIndex = await buildFdIndex()
  console.log(`[sync] ${Object.keys(_fdIndex).length} matches indexed`)
  loop(_fdIndex)
}

// Expose pour appel manuel (endpoint admin)
let _fdIndex = null
async function syncNow() {
  if (!_fdIndex) _fdIndex = await buildFdIndex()
  return syncOnce(_fdIndex)
}

module.exports = { startSync, syncNow }
