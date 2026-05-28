/**
 * Supprime les matchs test fictifs test_pl_* et injecte les vrais matchs
 * Premier League d'aujourd'hui depuis football-data.org.
 *
 * Usage : node server/scripts/seedTodayPL.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')
const { fetchMatches, mapMatch, mapGoals } = require('../footballData')

const PL_ID = 2021   // Premier League sur football-data.org

async function run() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`Date cible : ${today}`)

  // 1. Supprimer les anciens test_pl_* fictifs
  console.log('\nSuppression des test_pl_* fictifs...')
  const snap = await db.ref('matches').get()
  const existing = snap.exists() ? snap.val() : {}
  for (const [matchId] of Object.entries(existing)) {
    if (matchId.startsWith('test_pl_')) {
      await db.ref(`matches/${matchId}`).remove()
      console.log(`  ✗ supprimé ${matchId}`)
    }
  }

  // 2. Récupérer les matchs PL du jour
  console.log(`\nFetch Premier League matchday ${today}...`)
  let apiMatches = []
  try {
    apiMatches = await fetchMatches(PL_ID, { dateFrom: today, dateTo: today })
  } catch (err) {
    console.error('  API error:', err.message)
    process.exit(1)
  }

  if (apiMatches.length === 0) {
    console.log('  Aucun match Premier League aujourd\'hui selon l\'API.')
    process.exit(0)
  }

  console.log(`  ${apiMatches.length} match(s) trouvé(s)`)

  // 3. Seed dans Firebase avec fdId + buts déjà présents si dispo
  for (let i = 0; i < apiMatches.length; i++) {
    const apiMatch = apiMatches[i]
    const matchId = `pl_${today.replace(/-/g, '')}_${i + 1}`

    // Vérif doublon via fdId
    const alreadyExists = Object.values(existing).some(m => m.fdId === apiMatch.id)
    if (alreadyExists) {
      console.log(`  skip (fdId=${apiMatch.id} déjà en base)`)
      continue
    }

    const mapped = mapMatch(apiMatch, matchId, 'pl')

    // Inclure les buts si disponibles (match en cours / terminé)
    if (apiMatch.goals && apiMatch.goals.length > 0) {
      mapped.goals = mapGoals(apiMatch.goals, apiMatch.homeTeam?.id, apiMatch.awayTeam?.id)
    }

    await db.ref(`matches/${matchId}`).set(mapped)

    const time = mapped.time || '??:??'
    const status = apiMatch.status
    console.log(`  ✓ ${matchId} [${status}] ${time} — ${mapped.homeTeam.tla || mapped.homeTeam.name} vs ${mapped.awayTeam.tla || mapped.awayTeam.name}`)
  }

  console.log('\nDone.')
  process.exit(0)
}

run().catch((err) => {
  console.error('Erreur :', err)
  process.exit(1)
})
