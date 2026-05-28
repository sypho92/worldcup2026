const { db } = require('./firebase')
const { fetchMatches, fetchMatchDetail, mapGoals, normalizeWinner } = require('./footballData')
const { fetchFixturesByDate, fetchFixtureLive, fetchFixtureEvents, findAflFixture, mapAflGoals } = require('./apiFootball')

const COMPETITIONS = [
  { id: 2000, label: 'WC2026', params: () => ({ season: '2026' }) },
  // PL + Liga : uniquement les matchs du jour pour ne pas tirer toute la saison
  { id: 2021, label: 'PL', params: () => {
    const today = new Date().toISOString().slice(0, 10)
    return { dateFrom: today, dateTo: today }
  }},
  { id: 2014, label: 'Liga', params: () => {
    const today = new Date().toISOString().slice(0, 10)
    return { dateFrom: today, dateTo: today }
  }},
]

const POLL_LIVE_MS  = 1 * 60 * 1000    // 1 min when live or kickoff imminent
const POLL_IDLE_MS  = 60 * 60 * 1000   // 60 min max idle
const PREMATCH_LEAD = 5 * 60 * 1000    // wake up 5 min before kickoff
// Cache fixtures AFL du jour (1 seul appel par jour)
let _aflCache = { date: null, fixtures: [] }

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

// Returns overrides, previous statuses, previous scores, and nearest upcoming kickoff
async function refreshMatchState() {
  const snap = await db.ref('matches').get()
  const overrides            = {}
  const prevStatuses         = {}   // matchId → last known status
  const prevScores           = {}   // matchId → { home, away }
  const aflIds               = {}   // matchId → { aflId, aflHomeId, aflAwayId }
  const firstHalfKickoffs    = {}   // matchId → timestamp (null si pas encore enregistré)
  const secondHalfKickoffs   = {}   // matchId → timestamp (null si pas encore enregistré)
  let nearestKickoffMs = Infinity
  const now = Date.now()

  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([matchId, m]) => {
      overrides[matchId]          = m.manualOverride === true
      prevStatuses[matchId]       = m.status || null
      prevScores[matchId]         = {
        home: m.score?.fullTime?.home ?? null,
        away: m.score?.fullTime?.away ?? null,
      }
      firstHalfKickoffs[matchId]  = m.firstHalfKickoff  || null
      secondHalfKickoffs[matchId] = m.secondHalfKickoff || null
      if (m.aflId) aflIds[matchId] = { aflId: m.aflId, aflHomeId: m.aflHomeId, aflAwayId: m.aflAwayId }

      if (m.utcDate && !m.result) {
        const ts = new Date(m.utcDate).getTime()
        if (ts > now && ts < nearestKickoffMs) nearestKickoffMs = ts
      }
    })
  }

  return { overrides, prevStatuses, prevScores, aflIds, firstHalfKickoffs, secondHalfKickoffs, nearestKickoffMs }
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

  // Buteurs — inclus pour les matchs en cours et terminés
  if (apiMatch.goals && apiMatch.goals.length > 0) {
    updates.goals = mapGoals(
      apiMatch.goals,
      apiMatch.homeTeam?.id,
      apiMatch.awayTeam?.id,
    )
  }

  return updates
}

// File d'attente des matchs nécessitant un fetch de buts AFL
// matchId → { homeTeam, awayTeam } (données pour résoudre le fixture AFL)
const _goalsQueue = new Map()

async function syncCompetition(competitionId, fdIndex, overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs, params = {}) {
  const apiMatches = await fetchMatches(competitionId, params)
  let hasLive = false

  for (const apiMatch of apiMatches) {
    const matchId = fdIndex[apiMatch.id]
    if (!matchId) continue

    if (apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED') hasLive = true

    if (overrides[matchId]) continue

    const updates = buildUpdates(apiMatch)

    // 1ère mi-temps : enregistre le timestamp réel du coup d'envoi dès la première détection IN_PLAY
    // (pas depuis PAUSED qui est la 2e mi-temps)
    // Précision : au plus 1 min de retard (intervalle de sync) — bien mieux que utcDate qui peut
    // dériver si le match commence en avance ou en retard par rapport à l'heure officielle.
    const wasNotLive = !['IN_PLAY', 'PAUSED'].includes(prevStatuses[matchId])
    if (apiMatch.status === 'IN_PLAY' && wasNotLive && !firstHalfKickoffs[matchId]) {
      updates.firstHalfKickoff = Date.now()
      firstHalfKickoffs[matchId] = updates.firstHalfKickoff  // évite de réécrire au prochain cycle
      console.log(`[sync] 1st half kickoff recorded for ${matchId} @ ${new Date().toISOString()}`)
    }

    // 2ème mi-temps : enregistre l'heure du coup d'envoi (transition PAUSED → IN_PLAY)
    if (apiMatch.status === 'IN_PLAY' && prevStatuses[matchId] === 'PAUSED') {
      updates.secondHalfKickoff = Date.now()
      secondHalfKickoffs[matchId] = updates.secondHalfKickoff
      console.log(`[sync] 2nd half kickoff recorded for ${matchId}`)
    }

    // Récupération secondHalfKickoff si la transition PAUSED→IN_PLAY a été ratée
    // (ex : redémarrage serveur pendant la 2e mi-temps).
    // Détection : IN_PLAY + minute API > 45 + pas encore enregistré.
    // On rétrograde depuis la minute API pour que le client affiche la bonne minute immédiatement
    // (la minute API est décalée ~7 min, mais c'est le mieux possible sans vrai timestamp).
    if (
      apiMatch.status === 'IN_PLAY' &&
      !secondHalfKickoffs[matchId] &&
      (apiMatch.minute ?? 0) > 45
    ) {
      const minsIntoSecondHalf = (apiMatch.minute - 45)
      updates.secondHalfKickoff = Date.now() - minsIntoSecondHalf * 60 * 1000
      secondHalfKickoffs[matchId] = updates.secondHalfKickoff
      console.log(`[sync] 2nd half kickoff RECOVERED for ${matchId} (api minute: ${apiMatch.minute})`)
    }

    await db.ref(`matches/${matchId}`).update(updates)

    // Détection changement de score → file d'attente buts AFL
    if (process.env.AFL_API_KEY) {
      const newHome = apiMatch.score?.fullTime?.home ?? null
      const newAway = apiMatch.score?.fullTime?.away ?? null
      const prev    = prevScores[matchId] || { home: null, away: null }
      const scoreChanged = newHome !== prev.home || newAway !== prev.away
      const justFinished = apiMatch.status === 'FINISHED' && prevStatuses[matchId] !== 'FINISHED'

      if ((scoreChanged || justFinished) && newHome !== null) {
        _goalsQueue.set(matchId, { homeTeam: apiMatch.homeTeam, awayTeam: apiMatch.awayTeam })
        console.log(`[goals] score change détecté ${matchId} → ${newHome}-${newAway} (queued)`)
      }
    }
  }

  return hasLive
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Vide la file d'attente des buts : pour chaque match dont le score a changé,
 * fetch les events AFL et met à jour Firebase.
 * Coût : 1 req AFL par but marqué (+ 1 req/jour pour le cache fixtures).
 * Fonctionne pour n'importe quel nombre de matchs simultanés.
 */
async function drainGoalsQueue(aflIds) {
  if (_goalsQueue.size === 0) return
  if (!process.env.AFL_API_KEY) return

  // Cache fixtures du jour (1 req/jour max)
  const today = new Date().toISOString().slice(0, 10)
  if (_aflCache.date !== today) {
    try {
      _aflCache.fixtures = await fetchFixturesByDate(today)
      _aflCache.date = today
      console.log(`[goals] cache AFL : ${_aflCache.fixtures.length} fixtures pour ${today}`)
    } catch (err) {
      console.error('[goals] cache AFL erreur:', err.message)
      _goalsQueue.clear()
      return
    }
    await sleep(1000)
  }

  const queue = [..._goalsQueue.entries()]
  _goalsQueue.clear()

  for (const [matchId, teamData] of queue) {
    try {
      // Résolution aflId (stocké en base ou trouvé par fuzzy matching)
      let ids = aflIds[matchId]
      if (!ids?.aflId) {
        const fixture = findAflFixture(_aflCache.fixtures, teamData)
        if (!fixture) {
          console.warn(`[goals] ${matchId}: aucun fixture AFL — ${teamData.homeTeam?.tla} vs ${teamData.awayTeam?.tla}`)
          await sleep(500)
          continue
        }
        ids = { aflId: fixture.fixture.id, aflHomeId: fixture.teams.home.id, aflAwayId: fixture.teams.away.id }
        aflIds[matchId] = ids
        await db.ref(`matches/${matchId}`).update(ids)
        console.log(`[goals] ${matchId}: aflId résolu → ${ids.aflId}`)
      }

      const events = await fetchFixtureEvents(ids.aflId)
      const goals  = mapAflGoals(events, ids.aflHomeId, ids.aflAwayId)
      await db.ref(`matches/${matchId}/goals`).set(goals.length > 0 ? goals : null)
      console.log(`[goals] ${matchId}: ${goals.length} but(s) ← score change`)

    } catch (err) {
      console.warn(`[goals] ${matchId}: ${err.message}`)
    }
    await sleep(1000)  // léger délai entre appels
  }
}

/**
 * Sync matches that have an aflId but no fdId (ex: barrage Ligue 1).
 * Polls AFL directly for status, score, minute, and goals.
 */
async function syncAflOnly(overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs) {
  if (!process.env.AFL_API_KEY) return false
  const snap = await db.ref('matches').get()
  if (!snap.exists()) return false

  let hasLive = false

  const aflOnlyMatches = Object.entries(snap.val())
    .filter(([, m]) => m.aflId && !m.fdId)

  for (const [matchId, m] of aflOnlyMatches) {
    if (overrides[matchId]) continue

    let live
    try {
      live = await fetchFixtureLive(m.aflId)
    } catch (err) {
      console.error(`[afl-only] ${matchId}: ${err.message}`)
      await sleep(500)
      continue
    }
    if (!live) continue

    if (live.status === 'IN_PLAY' || live.status === 'PAUSED') hasLive = true

    const updates = {
      status: live.status,
      minute: live.elapsed ?? null,
      'score/winner': live.winner,
      'score/duration': 'REGULAR',
      'score/fullTime/home': live.homeScore,
      'score/fullTime/away': live.awayScore,
    }

    if (live.status === 'FINISHED' && live.winner !== null) {
      updates.result = { homeScore: live.homeScore, awayScore: live.awayScore, winner: live.winner }
    }

    // Kickoff 1ère mi-temps
    const wasNotLive = !['IN_PLAY', 'PAUSED'].includes(prevStatuses[matchId])
    if (live.status === 'IN_PLAY' && wasNotLive && !firstHalfKickoffs[matchId]) {
      updates.firstHalfKickoff = Date.now()
      firstHalfKickoffs[matchId] = updates.firstHalfKickoff
      console.log(`[afl-only] 1st half kickoff recorded for ${matchId}`)
    }

    // Kickoff 2ème mi-temps
    if (live.status === 'IN_PLAY' && prevStatuses[matchId] === 'PAUSED' && !secondHalfKickoffs[matchId]) {
      updates.secondHalfKickoff = Date.now()
      secondHalfKickoffs[matchId] = updates.secondHalfKickoff
      console.log(`[afl-only] 2nd half kickoff recorded for ${matchId}`)
    }

    // Récupération 2H si redémarrage en cours de 2e mi-temps
    if (live.status === 'IN_PLAY' && !secondHalfKickoffs[matchId] && (live.elapsed ?? 0) > 45) {
      updates.secondHalfKickoff = Date.now() - (live.elapsed - 45) * 60 * 1000
      secondHalfKickoffs[matchId] = updates.secondHalfKickoff
      console.log(`[afl-only] 2nd half kickoff RECOVERED for ${matchId}`)
    }

    await db.ref(`matches/${matchId}`).update(updates)

    // Buts : si score changé ou match terminé
    const prev = prevScores[matchId] || { home: null, away: null }
    const scoreChanged = live.homeScore !== prev.home || live.awayScore !== prev.away
    const justFinished = live.status === 'FINISHED' && prevStatuses[matchId] !== 'FINISHED'
    if ((scoreChanged || justFinished) && live.homeScore !== null) {
      try {
        const events = await fetchFixtureEvents(m.aflId)
        const goals  = mapAflGoals(events, m.aflHomeId, m.aflAwayId)
        await db.ref(`matches/${matchId}/goals`).set(goals.length > 0 ? goals : null)
        console.log(`[afl-only] ${matchId}: ${goals.length} but(s) mis à jour`)
      } catch (err) {
        console.warn(`[afl-only] goals ${matchId}: ${err.message}`)
      }
      await sleep(1000)
    }

    console.log(`[afl-only] ${matchId}: ${live.status} ${live.homeScore ?? '-'}:${live.awayScore ?? '-'} (${live.elapsed ?? '?'}')`)
    await sleep(500)
  }

  return hasLive
}

async function syncOnce(fdIndex) {
  const { overrides, prevStatuses, prevScores, aflIds, firstHalfKickoffs, secondHalfKickoffs, nearestKickoffMs } = await refreshMatchState()
  let hasLive = false

  for (const comp of COMPETITIONS) {
    try {
      const params = typeof comp.params === 'function' ? comp.params() : (comp.params || {})
      const live = await syncCompetition(comp.id, fdIndex, overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs, params)
      if (live) hasLive = true
    } catch (err) {
      console.error(`[sync] ${comp.label} error:`, err.message)
    }
  }

  // Vide la file des buts (déclenché uniquement si score a changé)
  if (_goalsQueue.size > 0) {
    drainGoalsQueue(aflIds).catch((err) => console.error('[goals] drain error:', err.message))
  }

  // Sync matchs AFL-only (sans fdId)
  try {
    const aflLive = await syncAflOnly(overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs)
    if (aflLive) hasLive = true
  } catch (err) {
    console.error('[afl-only] sync error:', err.message)
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
