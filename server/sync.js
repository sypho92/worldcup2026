const { db } = require('./firebase')
const { fetchFixturesByDate, fetchFixtureLive, fetchFixtureEvents, findAflFixture, mapAflGoals } = require('./apiFootball')

const DEV_MOCK = process.env.DEV_MOCK === 'true'

// ─── Intervalles de polling ──────────────────────────────────────────────────
const POLL_LIVE_MS     = 5 * 60 * 1000   // 5 min  — match en cours (IN_PLAY)
const POLL_HALFTIME_MS = 15 * 60 * 1000  // 15 min — mi-temps (PAUSED)
const POLL_PREMATCH_MS = 5 * 60 * 1000   // 5 min  — coup d'envoi passé, on attend IN_PLAY
const POLL_IDLE_MS     = 60 * 60 * 1000  // 60 min — aucun match imminant
const PREMATCH_LEAD    = 60 * 1000       // réveil 1 min avant le coup d'envoi

// ─── Cache AFL du jour (1 appel /jour) ──────────────────────────────────────
let _aflCache = { date: null, fixtures: [] }
let timer = null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// File d'attente des buts à récupérer
const _goalsQueue = new Map()

// ─── Lecture de l'état Firebase ─────────────────────────────────────────────
async function refreshMatchState() {
  const snap = await db.ref('matches').get()
  const overrides          = {}
  const prevStatuses       = {}
  const prevScores         = {}
  const aflIds             = {}
  const firstHalfKickoffs  = {}
  const secondHalfKickoffs = {}
  let nearestKickoffMs     = Infinity
  let hasCandidatesForPoll = false // au moins 1 match dont le KO est passé et pas terminé
  const now = Date.now()

  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([matchId, m]) => {
      overrides[matchId]          = m.manualOverride === true
      prevStatuses[matchId]       = m.status || null
      prevScores[matchId]         = { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null }
      firstHalfKickoffs[matchId]  = m.firstHalfKickoff  || null
      secondHalfKickoffs[matchId] = m.secondHalfKickoff || null
      if (m.aflId) aflIds[matchId] = { aflId: m.aflId, aflHomeId: m.aflHomeId, aflAwayId: m.aflAwayId }

      if (!m.utcDate) return
      const kickoff = new Date(m.utcDate).getTime()

      // Match pas encore terminé
      if (!m.result && m.status !== 'FINISHED') {
        if (kickoff <= now && now - kickoff <= 3.5 * 60 * 60 * 1000 && !overrides[matchId]) {
          hasCandidatesForPoll = true
        }
        if (kickoff > now && kickoff < nearestKickoffMs) {
          nearestKickoffMs = kickoff
        }
      }
    })
  }

  return { overrides, prevStatuses, prevScores, aflIds, firstHalfKickoffs, secondHalfKickoffs, nearestKickoffMs, hasCandidatesForPoll }
}

// ─── Drain de la file des buts ──────────────────────────────────────────────
async function drainGoalsQueue(aflIds) {
  if (_goalsQueue.size === 0) return
  if (!process.env.AFL_API_KEY) return

  const today = new Date().toISOString().slice(0, 10)
  if (_aflCache.date !== today) {
    try {
      _aflCache.fixtures = await fetchFixturesByDate(today)
      _aflCache.date = today
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
      let ids = aflIds[matchId]
      if (!ids?.aflId) {
        const fixture = findAflFixture(_aflCache.fixtures, teamData)
        if (!fixture) {
          console.warn(`[goals] ${matchId}: fixture AFL introuvable`)
          await sleep(500)
          continue
        }
        ids = { aflId: fixture.fixture.id, aflHomeId: fixture.teams.home.id, aflAwayId: fixture.teams.away.id }
        aflIds[matchId] = ids
        await db.ref(`matches/${matchId}`).update(ids)
      }
      const events = await fetchFixtureEvents(ids.aflId)
      const goals  = mapAflGoals(events, ids.aflHomeId, ids.aflAwayId)
      await db.ref(`matches/${matchId}/goals`).set(goals.length > 0 ? goals : null)
      console.log(`[goals] ${matchId}: ${goals.length} but(s)`)
    } catch (err) {
      console.warn(`[goals] ${matchId}: ${err.message}`)
    }
    await sleep(1000)
  }
}

// ─── Sync AFL ────────────────────────────────────────────────────────────────
// Retourne { hasLive, hasPaused }
async function syncAflLive(overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs, aflIds) {
  if (!process.env.AFL_API_KEY) return { hasLive: false, hasPaused: false }

  const now  = Date.now()
  const snap = await db.ref('matches').get()
  if (!snap.exists()) return { hasLive: false, hasPaused: false }

  // Candidats : coup d'envoi passé, pas terminé, pas d'override
  const candidates = []
  Object.entries(snap.val()).forEach(([matchId, m]) => {
    if (!m.utcDate) return
    const kickoff = new Date(m.utcDate).getTime()
    if (kickoff > now) return
    if (now - kickoff > 3.5 * 60 * 60 * 1000) return
    if (m.status === 'FINISHED' || m.result) return
    if (overrides[matchId]) return
    candidates.push({ matchId, m })
  })

  if (candidates.length === 0) return { hasLive: false, hasPaused: false }

  // Cache AFL du jour
  const today = new Date().toISOString().slice(0, 10)
  if (_aflCache.date !== today) {
    try {
      _aflCache.fixtures = await fetchFixturesByDate(today)
      _aflCache.date = today
      console.log(`[afl] cache : ${_aflCache.fixtures.length} fixtures pour ${today}`)
    } catch (err) {
      console.error('[afl] cache erreur:', err.message)
      return { hasLive: false, hasPaused: false }
    }
    await sleep(1000)
  }

  let hasLive   = false
  let hasPaused = false

  for (const { matchId, m } of candidates) {
    try {
      // Résolution AFL ID
      let ids = aflIds[matchId]
      if (!ids?.aflId) {
        const fixture = findAflFixture(_aflCache.fixtures, { homeTeam: m.homeTeam, awayTeam: m.awayTeam })
        if (!fixture) {
          console.warn(`[afl] ${matchId}: fixture introuvable (${m.homeTeam?.name} vs ${m.awayTeam?.name})`)
          continue
        }
        ids = { aflId: fixture.fixture.id, aflHomeId: fixture.teams.home.id, aflAwayId: fixture.teams.away.id }
        aflIds[matchId] = ids
        await db.ref(`matches/${matchId}`).update(ids)
        console.log(`[afl] ${matchId}: aflId=${ids.aflId} résolu`)
      }

      const live = await fetchFixtureLive(ids.aflId)
      if (!live) continue

      const updates = {}

      // ── Match en cours ──────────────────────────────────────────────────
      if (live.status === 'IN_PLAY') {
        hasLive = true
        updates.status = 'IN_PLAY'
        updates.minute = live.elapsed ?? null
        updates.minuteExtra = live.extra ?? null
        updates['score/fullTime/home'] = live.homeScore
        updates['score/fullTime/away'] = live.awayScore

        // Enregistre le coup d'envoi de la 1ère mi-temps
        if (!firstHalfKickoffs[matchId] && (live.elapsed ?? 0) <= 45) {
          const mins = Math.max(live.elapsed ?? 1, 1)
          updates.firstHalfKickoff = now - mins * 60 * 1000
          firstHalfKickoffs[matchId] = updates.firstHalfKickoff
          console.log(`[afl] ${matchId}: firstHalfKickoff enregistré`)
        }
        // Enregistre le coup d'envoi de la 2ème mi-temps
        if (!secondHalfKickoffs[matchId] && (live.elapsed ?? 0) > 45) {
          const mins = Math.max((live.elapsed ?? 46) - 45, 1)
          updates.secondHalfKickoff = now - mins * 60 * 1000
          secondHalfKickoffs[matchId] = updates.secondHalfKickoff
          console.log(`[afl] ${matchId}: secondHalfKickoff enregistré`)
        }

        // Changement de score → file buts
        const prev = prevScores[matchId] || { home: null, away: null }
        if (live.homeScore !== null && (live.homeScore !== prev.home || live.awayScore !== prev.away)) {
          _goalsQueue.set(matchId, { homeTeam: m.homeTeam, awayTeam: m.awayTeam })
          console.log(`[afl] ${matchId}: ⚽ score ${live.homeScore}-${live.awayScore} (${live.elapsed}')`)
        }

        console.log(`[afl] ${matchId}: IN_PLAY ${live.homeScore ?? '?'}-${live.awayScore ?? '?'} (${live.elapsed ?? '?'})`)

      // ── Mi-temps ────────────────────────────────────────────────────────
      } else if (live.status === 'PAUSED') {
        hasPaused = true
        updates.status = 'PAUSED'
        updates.minute = live.elapsed ?? 45
        updates['score/fullTime/home'] = live.homeScore
        updates['score/fullTime/away'] = live.awayScore
        console.log(`[afl] ${matchId}: MI-TEMPS ${live.homeScore ?? '?'}-${live.awayScore ?? '?'} — pause 15 min`)

      // ── Match terminé ───────────────────────────────────────────────────
      } else if (live.status === 'FINISHED') {
        updates.status = 'FINISHED'
        updates['score/fullTime/home'] = live.homeScore
        updates['score/fullTime/away'] = live.awayScore
        if (live.winner) {
          updates['score/winner'] = live.winner
          updates.result = { homeScore: live.homeScore, awayScore: live.awayScore, winner: live.winner }
        }
        _goalsQueue.set(matchId, { homeTeam: m.homeTeam, awayTeam: m.awayTeam })
        console.log(`[afl] ${matchId}: TERMINÉ ${live.homeScore}-${live.awayScore}`)

      // ── Pas encore démarré (AFL dit encore TIMED) ───────────────────────
      } else {
        console.log(`[afl] ${matchId}: statut AFL=${live.status} — KO passé, on attend...`)
      }

      if (Object.keys(updates).length > 0) {
        await db.ref(`matches/${matchId}`).update(updates)
      }

    } catch (err) {
      console.error(`[afl] ${matchId}: ${err.message}`)
    }
    await sleep(600)
  }

  return { hasLive, hasPaused }
}

// ─── syncOnce ────────────────────────────────────────────────────────────────
async function syncOnce() {
  const state = await refreshMatchState()
  const { overrides, prevStatuses, prevScores, aflIds, firstHalfKickoffs, secondHalfKickoffs, nearestKickoffMs, hasCandidatesForPoll } = state

  let hasLive   = false
  let hasPaused = false

  if (hasCandidatesForPoll) {
    try {
      const result = await syncAflLive(overrides, prevStatuses, prevScores, firstHalfKickoffs, secondHalfKickoffs, aflIds)
      hasLive   = result.hasLive
      hasPaused = result.hasPaused
    } catch (err) {
      console.error('[afl] sync error:', err.message)
    }

    if (_goalsQueue.size > 0) {
      drainGoalsQueue(aflIds).catch((err) => console.error('[goals] drain error:', err.message))
    }
  }

  return { hasLive, hasPaused, hasCandidatesForPoll, nearestKickoffMs }
}

// ─── Smart delay ─────────────────────────────────────────────────────────────
function computeDelay({ hasLive, hasPaused, hasCandidatesForPoll, nearestKickoffMs }) {
  // 1. Match en cours → 5 min
  if (hasLive) return POLL_LIVE_MS

  // 2. Mi-temps uniquement → 15 min
  if (hasPaused) return POLL_HALFTIME_MS

  // 3. KO passé, on attend le démarrage AFL → 5 min
  if (hasCandidatesForPoll) return POLL_PREMATCH_MS

  // 4. Aucun match actif → dormir jusqu'au prochain KO (−1 min)
  if (nearestKickoffMs === Infinity) return POLL_IDLE_MS
  const msUntil = nearestKickoffMs - Date.now()
  if (msUntil <= PREMATCH_LEAD) return POLL_PREMATCH_MS
  return Math.min(msUntil - PREMATCH_LEAD, POLL_IDLE_MS)
}

// ─── Loop principale ─────────────────────────────────────────────────────────
async function loop() {
  try {
    const result = await syncOnce()
    const { hasLive, hasPaused, hasCandidatesForPoll, nearestKickoffMs } = result
    const delay    = computeDelay(result)
    const delayMin = (delay / 60000).toFixed(0)
    const ts       = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    if (hasLive) {
      console.log(`[sync] 🔴 LIVE [${ts}] — prochain poll dans ${delayMin}min`)
    } else if (hasPaused) {
      console.log(`[sync] ⏸ MI-TEMPS [${ts}] — pause de ${delayMin}min`)
    } else if (hasCandidatesForPoll) {
      console.log(`[sync] ⏳ EN ATTENTE DÉMARRAGE [${ts}] — poll dans ${delayMin}min`)
    } else {
      const info = nearestKickoffMs !== Infinity
        ? `prochain KO dans ${((nearestKickoffMs - Date.now()) / 60000).toFixed(0)}min`
        : 'aucun match à venir'
      console.log(`[sync] 💤 IDLE [${ts}] — ${info}, réveil dans ${delayMin}min`)
    }

    timer = setTimeout(loop, delay)
  } catch (err) {
    console.error('[sync] loop error:', err.message)
    timer = setTimeout(loop, POLL_IDLE_MS)
  }
}

// ─── Démarrage ───────────────────────────────────────────────────────────────
async function startSync() {
  if (DEV_MOCK) {
    console.log('[sync] DEV_MOCK=true — polling API désactivé')
    return
  }
  console.log('[sync] démarrage — mode AFL-only')
  console.log('[sync] polling: 5min live | 15min mi-temps | 5min pré-match | idle jusqu\'au KO')
  loop()
}

async function syncNow() {
  if (DEV_MOCK) return { hasLive: false }
  return syncOnce()
}

module.exports = { startSync, syncNow }
