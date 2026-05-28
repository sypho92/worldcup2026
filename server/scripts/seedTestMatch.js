/**
 * Injecte un match de test manuel dans Firebase.
 * Usage : node server/scripts/seedTestMatch.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')

async function run() {
  const matchId = 'test_20260528_u17'

  // 21h00 Paris = 19h00 UTC le 28 mai 2026
  const utcDate = '2026-05-28T19:00:00Z'
  const d = new Date(utcDate)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' }) // YYYY-MM-DD
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })

  const match = {
    id: matchId,
    fdId: null,
    utcDate,
    date,
    time,
    status: 'TIMED',
    minute: null,
    phase: 'group',
    group: 'T',
    matchday: 1,
    venue: 'Stade Mohammed V, Casablanca',
    homeTeam: {
      name: 'Maroc U17',
      tla: 'MAR',
      crest: null,
      flag: '🇲🇦',
    },
    awayTeam: {
      name: 'Sénégal U17',
      tla: 'SEN',
      crest: null,
      flag: '🇸🇳',
    },
    score: {
      winner: null,
      duration: 'REGULAR',
      fullTime: { home: null, away: null },
      halfTime: { home: null, away: null },
    },
    result: null,
    goals: null,
    manualOverride: false,
  }

  await db.ref(`matches/${matchId}`).set(match)
  console.log(`✓ Match injecté : ${matchId} — ${date} ${time} — MAR vs SEN`)
  console.log('  → Visible immédiatement dans l\'app.')
  process.exit(0)
}

run().catch((err) => {
  console.error('Erreur :', err)
  process.exit(1)
})
