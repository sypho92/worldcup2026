require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { db } = require('./firebase')
const { startSync, syncNow } = require('./sync')
const { fetchMatches, mapMatch, STAGE_TO_PHASE } = require('./footballData')
const discord = require('./discord')
discord.connect()

const app = express()
const PORT = process.env.PORT || 3001
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

app.use(cors())
app.use(express.json())

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Admin auth — never exposes password to client
app.post('/api/auth/admin', (req, res) => {
  const { password } = req.body
  if (!password) return res.status(400).json({ error: 'Password required' })
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true })
  } else {
    res.status(401).json({ error: 'Wrong password' })
  }
})

// Write match result (admin only)
const PHASE_PTS = { group: 1, demo: 1, liga: 1, pl: 1, test: 1, cl_final: 1, r32: 2, r16: 3, qf: 4, sf: 5, third: 3, final: 6 }

async function snapshotRanks() {
  const [playersSnap, betsSnap, matchesSnap] = await Promise.all([
    db.ref('players').get(),
    db.ref('bets').get(),
    db.ref('matches').get(),
  ])
  if (!playersSnap.exists()) return

  const players = playersSnap.val()
  const allBets = betsSnap.exists() ? betsSnap.val() : {}
  const matches = matchesSnap.exists() ? Object.entries(matchesSnap.val()) : []

  const scores = Object.keys(players).map((pseudoId) => {
    const playerBets = allBets[pseudoId] || {}
    let total = 0, correct = 0, wrong = 0
    matches.forEach(([matchId, m]) => {
      const result = m.result
      const bet = playerBets[matchId]
      if (!result || !bet) return
      if (bet === result.winner) { total += PHASE_PTS[m.phase] ?? 1; correct++ }
      else wrong++
    })
    return { pseudoId, total, correct, wrong }
  }).sort((a, b) => b.total - a.total || a.wrong - b.wrong || b.correct - a.correct)

  const snapshot = {}
  scores.forEach((p, i) => { snapshot[p.pseudoId] = i + 1 })
  await db.ref('scoreboard_snapshot').set(snapshot)
}

app.post('/api/results/:matchId', async (req, res) => {
  const { password, homeScore, awayScore, homeTeam, awayTeam } = req.body
  const { matchId } = req.params

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (homeScore === undefined || awayScore === undefined) {
    return res.status(400).json({ error: 'homeScore and awayScore required' })
  }

  const hs = parseInt(homeScore, 10)
  const as = parseInt(awayScore, 10)
  if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) {
    return res.status(400).json({ error: 'Scores must be non-negative integers' })
  }

  let winner
  if (hs > as) winner = 'home'
  else if (as > hs) winner = 'away'
  else winner = 'draw'

  try {
    await snapshotRanks()
    await db.ref(`matches/${matchId}`).update({
      result: { homeScore: hs, awayScore: as, winner },
      'score/winner': winner,
      'score/fullTime/home': hs,
      'score/fullTime/away': as,
      status: 'FINISHED',
      manualOverride: true,
    })

    // Also update team names if provided (for knockout matches)
    if (homeTeam) await db.ref(`matches/${matchId}/homeTeam`).set(homeTeam)
    if (awayTeam) await db.ref(`matches/${matchId}/awayTeam`).set(awayTeam)

    res.json({ success: true, matchId, homeScore: hs, awayScore: as, winner })
  } catch (err) {
    console.error('Firebase write error:', err)
    res.status(500).json({ error: 'Database write failed' })
  }
})

// Delete match result (admin only)
app.delete('/api/results/:matchId', async (req, res) => {
  const { password } = req.body
  const { matchId } = req.params

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await db.ref(`matches/${matchId}`).update({
      result: null,
      manualOverride: false,
      'score/winner': null,
      'score/fullTime/home': null,
      'score/fullTime/away': null,
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

// Remove manualOverride — resumes auto sync for this match
app.delete('/api/matches/:matchId/override', async (req, res) => {
  const { password } = req.body
  const { matchId } = req.params
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  try {
    await db.ref(`matches/${matchId}/manualOverride`).set(false)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
  }
})

// Force sync immédiat (admin only) — utile pour tester sans attendre le timer
app.post('/api/admin/sync-now', async (req, res) => {
  const { password } = req.body
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const result = await syncNow()
    res.json({ success: true, hasLive: result.hasLive })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Test Discord live events (admin only) — simule les events d'un match
app.post('/api/admin/discord-test/:matchId', async (req, res) => {
  const { password, event, homeScore = 1, awayScore = 0 } = req.body
  const { matchId } = req.params
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  if (!discord.isConfigured()) return res.status(503).json({ error: 'Discord non configuré' })

  try {
    const snap = await db.ref(`matches/${matchId}`).once('value')
    const m = snap.val()
    if (!m) return res.status(404).json({ error: 'Match introuvable' })

    const match = { id: matchId, homeTeam: m.homeTeam, awayTeam: m.awayTeam }
    const ht = m.homeTeam?.tla || '?'
    const at = m.awayTeam?.tla || '?'
    const hs = Number(homeScore)
    const as_ = Number(awayScore)

    const events = {
      start:    () => Promise.all([discord.joinMatchVoice(match), discord.postMatchUpdate(match, `🔴 **Match démarré !** ${ht} vs ${at}`)]),
      halftime: () => discord.postMatchUpdate(match, `⏸ **Mi-temps** : ${ht} **${hs}–${as_}** ${at}`),
      second:   () => discord.postMatchUpdate(match, `▶ **2ème mi-temps** : ${ht} **${hs}–${as_}** ${at}`),
      goal:     () => discord.postMatchUpdate(match, `⚽ **But !** ${ht} **${hs}–${as_}** ${at}`),
      end:      () => Promise.all([discord.postMatchUpdate(match, `🏁 **Fin du match !** ${ht} **${hs}–${as_}** ${at}`), Promise.resolve(discord.leaveMatchVoice(matchId))]),
    }

    if (!events[event]) return res.status(400).json({ error: `event inconnu, valeurs possibles : ${Object.keys(events).join(', ')}` })
    await events[event]()
    res.json({ success: true, event, matchId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Diagnostic : liste les matchs retournés par football-data pour WC2026 (admin only)
app.get('/api/admin/api-matches', async (req, res) => {
  const { password } = req.query
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const matches = await fetchMatches(2000, { season: '2026' })
    res.json({
      count: matches.length,
      matches: matches.slice(0, 10).map((m) => ({
        id: m.id,
        utcDate: m.utcDate,
        status: m.status,
        home: m.homeTeam?.name,
        away: m.awayTeam?.name,
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Patch manuel d'une date de match (admin only) — fallback si fdId manque
app.post('/api/admin/patch-match-date', async (req, res) => {
  const { password, matchId, utcDate } = req.body
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  if (!matchId || !utcDate) return res.status(400).json({ error: 'matchId and utcDate required' })
  try {
    const d = new Date(utcDate)
    const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })
    await db.ref(`matches/${matchId}`).update({ utcDate, date, time })
    res.json({ success: true, matchId, utcDate, date, time })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Watch party — crée (ou réutilise) un salon vocal Discord pour le match
app.post('/api/watchparty/:matchId', async (req, res) => {
  const { matchId } = req.params
  if (!discord.isConfigured()) {
    return res.status(503).json({ error: 'Discord non configuré (DISCORD_BOT_TOKEN / DISCORD_GUILD_ID)' })
  }
  try {
    const { homeTeam, awayTeam } = req.body
    if (!homeTeam || !awayTeam) return res.status(400).json({ error: 'homeTeam/awayTeam requis' })
    const match = { id: matchId, homeTeam, awayTeam }
    const party = await discord.createWatchParty(match)
    res.json({ success: true, ...party })
  } catch (err) {
    console.error('Watch party error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Serve Vite build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')))
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  startSync()
})
