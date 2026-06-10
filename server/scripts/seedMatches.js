/**
 * Seed WC2026 matches from football-data.org.
 * Usage : node server/scripts/seedMatches.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')
const { fetchMatches, mapMatch } = require('../footballData')

const WC_ID = 2000

function sortChronologically(matches) {
  return [...matches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
}

async function seedWC2026() {
  console.log('Fetching WC2026 matches...')
  const snap = await db.ref('matches').get()
  const existing = snap.exists() ? snap.val() : {}

  const apiMatches = await fetchMatches(WC_ID, { season: '2026' })
  const sorted = sortChronologically(apiMatches)

  const batch = {}
  let skipped = 0

  for (let i = 0; i < sorted.length; i++) {
    const apiMatch = sorted[i]
    if (Object.values(existing).some(m => m.fdId === apiMatch.id)) {
      skipped++
      continue
    }
    const matchId = `m${String(i + 1).padStart(3, '0')}`
    batch[matchId] = mapMatch(apiMatch, matchId)
  }

  if (Object.keys(batch).length > 0) {
    await db.ref('matches').update(batch)
    console.log(`WC2026: ${Object.keys(batch).length} seeded, ${skipped} skipped`)
  } else {
    console.log(`WC2026: all ${skipped} already exist`)
  }
}

seedWC2026()
  .then(() => { console.log('Done.'); process.exit(0) })
  .catch(err => { console.error(err); process.exit(1) })
