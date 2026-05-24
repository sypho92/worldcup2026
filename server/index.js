require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { db } = require('./firebase')
const { startSync, syncNow } = require('./sync')
const { fetchMatches, mapMatch, STAGE_TO_PHASE } = require('./footballData')

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
