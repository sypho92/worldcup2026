require('dotenv').config({ path: require('path').join(__dirname, '../../.env') })
const { db } = require('../firebase')
const { fetchMatches, mapMatch } = require('../footballData')

const COMPETITIONS = {
  WC: 2000,
  CL: 2001,
  LIGA: 2014,
}

const DEMO_MATCHES = [
  {
    id: 'demo_1',
    fdId: null,
    utcDate: '2026-05-17T16:00:00Z',
    status: 'FINISHED',
    phase: 'demo',
    group: null,
    matchday: null,
    venue: 'Rose Bowl, Los Angeles',
    homeTeam: { name: 'Argentine', tla: 'ARG', crest: 'https://crests.football-data.org/762.svg' },
    awayTeam: { name: 'Allemagne', tla: 'GER', crest: 'https://crests.football-data.org/759.svg' },
    score: { winner: 'home', duration: 'REGULAR', fullTime: { home: 3, away: 1 }, halfTime: { home: 1, away: 0 } },
    result: { homeScore: 3, awayScore: 1, winner: 'home' },
    goals: [],
    manualOverride: false,
    minute: 90,
  },
  {
    id: 'demo_2',
    fdId: null,
    utcDate: '2026-05-18T18:00:00Z',
    status: 'FINISHED',
    phase: 'demo',
    group: null,
    matchday: null,
    venue: 'SoFi Stadium, Los Angeles',
    homeTeam: { name: 'Espagne', tla: 'ESP', crest: 'https://crests.football-data.org/760.svg' },
    awayTeam: { name: 'Portugal', tla: 'POR', crest: 'https://crests.football-data.org/765.svg' },
    score: { winner: 'away', duration: 'REGULAR', fullTime: { home: 0, away: 2 }, halfTime: { home: 0, away: 1 } },
    result: { homeScore: 0, awayScore: 2, winner: 'away' },
    goals: [],
    manualOverride: false,
    minute: 90,
  },
  {
    id: 'demo_0',
    fdId: null,
    utcDate: '2026-05-19T18:00:00Z',
    status: 'SCHEDULED',
    phase: 'demo',
    group: null,
    matchday: null,
    venue: 'MetLife Stadium, New York/NJ',
    homeTeam: { name: 'France', tla: 'FRA', crest: 'https://crests.football-data.org/773.svg' },
    awayTeam: { name: 'Brésil', tla: 'BRA', crest: 'https://crests.football-data.org/764.svg' },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
    result: null,
    goals: [],
    manualOverride: false,
    minute: null,
  },
]

function sortChronologically(matches) {
  return [...matches].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))
}

async function fdIdAlreadySeeded(fdId) {
  const snap = await db.ref('matches').orderByChild('fdId').equalTo(fdId).limitToFirst(1).get()
  return snap.exists()
}

async function matchIdAlreadySeeded(matchId) {
  const snap = await db.ref(`matches/${matchId}`).get()
  return snap.exists()
}

async function seedWC2026() {
  console.log('Fetching WC2026 matches...')
  const apiMatches = await fetchMatches(COMPETITIONS.WC)
  const sorted = sortChronologically(apiMatches)

  const batch = {}
  let skipped = 0

  for (let i = 0; i < sorted.length; i++) {
    const apiMatch = sorted[i]
    const matchId = `m${String(i + 1).padStart(3, '0')}`

    if (await fdIdAlreadySeeded(apiMatch.id)) {
      skipped++
      continue
    }

    const mapped = mapMatch(apiMatch, matchId)
    batch[matchId] = mapped
  }

  if (Object.keys(batch).length > 0) {
    await db.ref('matches').update(batch)
    console.log(`WC2026: ${Object.keys(batch).length} seeded, ${skipped} skipped`)
  } else {
    console.log(`WC2026: 0 seeded (all ${skipped} already exist)`)
  }
}

async function seedDemoMatches() {
  console.log('Seeding fictional demo matches...')
  for (const m of DEMO_MATCHES) {
    if (await matchIdAlreadySeeded(m.id)) {
      console.log(`  skip ${m.id} (already seeded)`)
      continue
    }
    await db.ref(`matches/${m.id}`).set(m)
    console.log(`  seeded ${m.id}: ${m.homeTeam.name} vs ${m.awayTeam.name}`)
  }
}

async function seedTodayLigaMatches() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`Fetching La Liga matches for ${today}...`)

  let apiMatches = []
  try {
    apiMatches = await fetchMatches(COMPETITIONS.LIGA, { dateFrom: today, dateTo: today })
  } catch (err) {
    console.warn(`  La Liga fetch failed: ${err.message} — skipping`)
    return
  }

  let counter = 1
  for (const apiMatch of apiMatches) {
    const matchId = `demo_liga${counter}`
    counter++

    if (await fdIdAlreadySeeded(apiMatch.id)) {
      console.log(`  skip ${matchId} fdId=${apiMatch.id} (already seeded)`)
      continue
    }

    const mapped = mapMatch(apiMatch, matchId, 'liga')
    await db.ref(`matches/${matchId}`).set(mapped)
    console.log(`  seeded ${matchId}: ${mapped.homeTeam.name} vs ${mapped.awayTeam.name}`)
  }
}

async function seedCLFinal() {
  console.log('Fetching CL Final...')

  let apiMatches = []
  try {
    apiMatches = await fetchMatches(COMPETITIONS.CL, {
      dateFrom: '2026-05-28',
      dateTo: '2026-06-01',
      stage: 'FINAL',
    })
  } catch (err) {
    console.warn(`  CL fetch failed: ${err.message} — skipping`)
    return
  }

  for (const apiMatch of apiMatches) {
    const matchId = 'demo_cl'

    if (await fdIdAlreadySeeded(apiMatch.id)) {
      console.log(`  skip ${matchId} (already seeded)`)
      continue
    }

    const mapped = mapMatch(apiMatch, matchId, 'cl_final')
    await db.ref(`matches/${matchId}`).set(mapped)
    console.log(`  seeded ${matchId}: ${mapped.homeTeam.name} vs ${mapped.awayTeam.name}`)
  }
}

async function main() {
  try {
    await seedWC2026()
    await seedDemoMatches()
    await seedTodayLigaMatches()
    await seedCLFinal()
    console.log('\nSeed complete.')
    process.exit(0)
  } catch (err) {
    console.error('Seed failed:', err)
    process.exit(1)
  }
}

main()
