/**
 * Lance le match test en IN_PLAY avec le bon timestamp kickoff.
 * Usage : node scripts/testKickoff.js
 */
require('dotenv').config()
const { db } = require('../firebase')

const MATCH_ID = 'test_20260528_u17'

async function run() {
  const now = Date.now()
  await db.ref(`matches/${MATCH_ID}`).update({
    status: 'IN_PLAY',
    minute: 1,
    firstHalfKickoff: now,
    secondHalfKickoff: null,
  })
  console.log(`✓ Match lancé en IN_PLAY — kickoff enregistré à ${new Date(now).toLocaleTimeString('fr-FR')}`)
  console.log('  → Le chrono démarre dans l\'app.')
  process.exit(0)
}

run().catch(err => { console.error(err); process.exit(1) })
