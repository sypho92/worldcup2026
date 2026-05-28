/**
 * Injecte des matchs test "Premier League" dans Firebase
 * pour tester le système de challenges / lock / annulation.
 *
 * Les matchs ont tous un utcDate = aujourd'hui 2026-05-24 à 15:00 UTC (17:00 Paris)
 * → ils apparaissent comme "déjà commencés" pour tester le verrouillage.
 * Un quatrième match est planifié à 17:00 UTC (19:00 Paris) → encore ouvert aux paris.
 *
 * Usage : node server/scripts/seedTestPL.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')

const TEST_MATCHES = [
  {
    id: 'test_pl_1',
    fdId: null,
    utcDate: '2026-05-24T15:00:00Z',   // 17:00 Paris — déjà commencé
    status: 'IN_PLAY',
    phase: 'test',
    group: null,
    matchday: 38,
    venue: 'Anfield, Liverpool',
    homeTeam: {
      name: 'Liverpool',
      tla: 'LIV',
      crest: 'https://crests.football-data.org/64.svg',
    },
    awayTeam: {
      name: 'Manchester City',
      tla: 'MCI',
      crest: 'https://crests.football-data.org/65.svg',
    },
    result: null,
    manualOverride: false,
    minute: 54,
  },
  {
    id: 'test_pl_2',
    fdId: null,
    utcDate: '2026-05-24T15:00:00Z',   // 17:00 Paris — déjà commencé
    status: 'IN_PLAY',
    phase: 'test',
    group: null,
    matchday: 38,
    venue: 'Old Trafford, Manchester',
    homeTeam: {
      name: 'Manchester Utd',
      tla: 'MUN',
      crest: 'https://crests.football-data.org/66.svg',
    },
    awayTeam: {
      name: 'Arsenal',
      tla: 'ARS',
      crest: 'https://crests.football-data.org/57.svg',
    },
    result: null,
    manualOverride: false,
    minute: 52,
  },
  {
    id: 'test_pl_3',
    fdId: null,
    utcDate: '2026-05-24T15:00:00Z',   // 17:00 Paris — déjà commencé
    status: 'IN_PLAY',
    phase: 'test',
    group: null,
    matchday: 38,
    venue: 'Stamford Bridge, Londres',
    homeTeam: {
      name: 'Chelsea',
      tla: 'CHE',
      crest: 'https://crests.football-data.org/61.svg',
    },
    awayTeam: {
      name: 'Tottenham',
      tla: 'TOT',
      crest: 'https://crests.football-data.org/73.svg',
    },
    result: null,
    manualOverride: false,
    minute: 67,
  },
  {
    id: 'test_pl_4',
    fdId: null,
    utcDate: '2026-05-24T17:00:00Z',   // 19:00 Paris — pas encore commencé
    status: 'SCHEDULED',
    phase: 'test',
    group: null,
    matchday: 38,
    venue: 'Villa Park, Birmingham',
    homeTeam: {
      name: 'Aston Villa',
      tla: 'AVL',
      crest: 'https://crests.football-data.org/58.svg',
    },
    awayTeam: {
      name: 'Newcastle',
      tla: 'NEW',
      crest: 'https://crests.football-data.org/67.svg',
    },
    result: null,
    manualOverride: false,
    minute: null,
  },
]

async function seedTestPL() {
  console.log('Injection des matchs test Premier League...\n')

  for (const m of TEST_MATCHES) {
    await db.ref(`matches/${m.id}`).set(m)
    const timeLabel = m.utcDate.includes('T15:') ? '17:00 Paris (commencé)' : '19:00 Paris (à venir)'
    console.log(`  ✓ ${m.id} — ${m.homeTeam.tla} vs ${m.awayTeam.tla}  [${timeLabel}]`)
  }

  console.log('\nDone. 4 matchs injectés.')
  process.exit(0)
}

seedTestPL().catch((err) => {
  console.error('Erreur :', err)
  process.exit(1)
})
