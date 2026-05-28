/**
 * Ajoute des buts fictifs aux matchs test Premier League pour valider l'UI.
 * Usage : node server/scripts/addTestGoals.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')

const GOALS = {
  test_pl_1: [
    // Liverpool vs Man City — score 2-1
    { minute: 18, minuteExtra: null, type: 'REGULAR',  scorer: 'M. Salah',     assist: 'T. Alexander-Arnold', side: 'home' },
    { minute: 34, minuteExtra: null, type: 'OWN_GOAL', scorer: 'R. Dias',      assist: null,                  side: 'home' },
    { minute: 51, minuteExtra: null, type: 'REGULAR',  scorer: 'E. Haaland',   assist: 'K. De Bruyne',        side: 'away' },
  ],
  test_pl_2: [
    // Man Utd vs Arsenal — score 1-2
    { minute: 11, minuteExtra: null, type: 'REGULAR',  scorer: 'B. Saka',      assist: 'M. Ødegaard',         side: 'away' },
    { minute: 45, minuteExtra: 2,    type: 'PENALTY',  scorer: 'R. Højlund',   assist: null,                  side: 'home' },
    { minute: 72, minuteExtra: null, type: 'REGULAR',  scorer: 'L. Trossard',  assist: 'B. White',            side: 'away' },
  ],
  test_pl_3: [
    // Chelsea vs Tottenham — score 3-1
    { minute: 8,  minuteExtra: null, type: 'REGULAR',  scorer: 'C. Palmer',    assist: null,                  side: 'home' },
    { minute: 27, minuteExtra: null, type: 'REGULAR',  scorer: 'N. Jackson',   assist: 'C. Palmer',           side: 'home' },
    { minute: 58, minuteExtra: null, type: 'REGULAR',  scorer: 'H. Son',       assist: 'P. Porro',            side: 'away' },
    { minute: 67, minuteExtra: null, type: 'OWN_GOAL', scorer: 'B. Davies',    assist: null,                  side: 'home' },
  ],
}

async function run() {
  for (const [matchId, goals] of Object.entries(GOALS)) {
    await db.ref(`matches/${matchId}/goals`).set(goals)
    console.log(`✓ ${matchId} — ${goals.length} but(s) ajoutés`)
  }
  process.exit(0)
}

run().catch((err) => { console.error(err); process.exit(1) })
