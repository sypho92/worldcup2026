/**
 * Injecte les matchs La Liga d'aujourd'hui depuis football-data.org.
 * Skipps les matchs déjà en base (par fdId).
 *
 * Usage : node server/scripts/seedTodayLiga.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')
const { fetchMatches, mapMatch, mapGoals } = require('../footballData')

const LIGA_ID = 2014  // La Liga (Primera Division)

async function run() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`Date cible : ${today}`)

  // Snapshot pour vérifier les doublons
  const snap = await db.ref('matches').get()
  const existing = snap.exists() ? snap.val() : {}

  // Récupérer les matchs Liga du jour
  console.log(`\nFetch La Liga matchday ${today}...`)
  let apiMatches = []
  try {
    apiMatches = await fetchMatches(LIGA_ID, { dateFrom: today, dateTo: today })
  } catch (err) {
    console.error('  API error:', err.message)
    process.exit(1)
  }

  if (apiMatches.length === 0) {
    console.log('  Aucun match La Liga aujourd\'hui selon l\'API.')
    process.exit(0)
  }

  console.log(`  ${apiMatches.length} match(s) trouvé(s)`)

  // Seed dans Firebase
  let seeded = 0
  for (let i = 0; i < apiMatches.length; i++) {
    const apiMatch = apiMatches[i]

    // Skip doublon via fdId
    const alreadyExists = Object.values(existing).some(m => m.fdId === apiMatch.id)
    if (alreadyExists) {
      console.log(`  skip (fdId=${apiMatch.id} déjà en base) — ${apiMatch.homeTeam?.tla} vs ${apiMatch.awayTeam?.tla}`)
      continue
    }

    const matchId = `liga_${today.replace(/-/g, '')}_${i + 1}`
    const mapped = mapMatch(apiMatch, matchId, 'liga')

    // Inclure les buts si dispo
    if (apiMatch.goals && apiMatch.goals.length > 0) {
      mapped.goals = mapGoals(apiMatch.goals, apiMatch.homeTeam?.id, apiMatch.awayTeam?.id)
    }

    await db.ref(`matches/${matchId}`).set(mapped)
    seeded++

    const time = mapped.time || '??:??'
    console.log(`  ✓ ${matchId} [${apiMatch.status}] ${time} — ${mapped.homeTeam.tla || mapped.homeTeam.name} vs ${mapped.awayTeam.tla || mapped.awayTeam.name}`)
  }

  if (seeded === 0) console.log('  Aucun nouveau match à ajouter.')
  console.log('\nDone.')
  process.exit(0)
}

run().catch((err) => {
  console.error('Erreur :', err)
  process.exit(1)
})
