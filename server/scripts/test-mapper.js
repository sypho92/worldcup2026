const { test } = require('node:test')
const assert = require('node:assert/strict')
const { mapMatch, normalizeWinner } = require('../footballData')

test('normalizeWinner', () => {
  assert.equal(normalizeWinner('HOME_TEAM'), 'home')
  assert.equal(normalizeWinner('AWAY_TEAM'), 'away')
  assert.equal(normalizeWinner('DRAW'), 'draw')
  assert.equal(normalizeWinner(null), null)
})

test('mapMatch group stage scheduled', () => {
  const api = {
    id: 999,
    utcDate: '2026-06-11T21:00:00Z',
    status: 'SCHEDULED',
    minute: null,
    stage: 'GROUP_STAGE',
    group: 'GROUP_A',
    matchday: 1,
    venue: 'MetLife Stadium',
    homeTeam: { name: 'États-Unis', tla: 'USA', crest: 'https://example.com/usa.svg' },
    awayTeam: { name: 'Mexique', tla: 'MEX', crest: 'https://example.com/mex.svg' },
    score: { winner: null, duration: 'REGULAR', fullTime: { home: null, away: null }, halfTime: { home: null, away: null } },
  }
  const result = mapMatch(api, 'm001')
  assert.equal(result.id, 'm001')
  assert.equal(result.fdId, 999)
  assert.equal(result.phase, 'group')
  assert.equal(result.group, 'A')
  assert.equal(result.result, null)
  assert.equal(result.manualOverride, false)
  assert.deepEqual(result.goals, [])
})

test('mapMatch finished with home winner', () => {
  const api = {
    id: 999,
    utcDate: '2026-06-11T21:00:00Z',
    status: 'FINISHED',
    minute: 90,
    stage: 'GROUP_STAGE',
    group: 'GROUP_A',
    matchday: 1,
    venue: 'MetLife Stadium',
    homeTeam: { name: 'France', tla: 'FRA', crest: null },
    awayTeam: { name: 'Brésil', tla: 'BRA', crest: null },
    score: { winner: 'HOME_TEAM', duration: 'REGULAR', fullTime: { home: 2, away: 1 }, halfTime: { home: 1, away: 0 } },
  }
  const result = mapMatch(api, 'm001')
  assert.deepEqual(result.result, { homeScore: 2, awayScore: 1, winner: 'home' })
  assert.equal(result.score.winner, 'home')
  assert.equal(result.score.fullTime.home, 2)
  assert.equal(result.score.halfTime.home, 1)
})
