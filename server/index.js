require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const { db } = require('./firebase')

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
    await db.ref(`matches/${matchId}/result`).set({ homeScore: hs, awayScore: as, winner })

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
    await db.ref(`matches/${matchId}/result`).remove()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'Database error' })
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
})
