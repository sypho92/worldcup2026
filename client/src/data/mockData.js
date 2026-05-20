// All 104 FIFA World Cup 2026 matches
// Group stage: 72 matches (12 groups × 6 matches each, round-robin)
// Knockout: 32 matches (R32:16, R16:8, QF:4, SF:2, 3rd:1, Final:1)

const GROUPS = {
  A: {
    teams: [
      { name: 'États-Unis', flag: '🇺🇸' },
      { name: 'Mexique', flag: '🇲🇽' },
      { name: 'Pologne', flag: '🇵🇱' },
      { name: 'Arabie Saoudite', flag: '🇸🇦' },
    ],
  },
  B: {
    teams: [
      { name: 'France', flag: '🇫🇷' },
      { name: 'Maroc', flag: '🇲🇦' },
      { name: 'Australie', flag: '🇦🇺' },
      { name: 'Guatemala', flag: '🇬🇹' },
    ],
  },
  C: {
    teams: [
      { name: 'Argentine', flag: '🇦🇷' },
      { name: 'Canada', flag: '🇨🇦' },
      { name: 'Suisse', flag: '🇨🇭' },
      { name: 'Égypte', flag: '🇪🇬' },
    ],
  },
  D: {
    teams: [
      { name: 'Brésil', flag: '🇧🇷' },
      { name: 'Japon', flag: '🇯🇵' },
      { name: 'Serbie', flag: '🇷🇸' },
      { name: 'Jamaïque', flag: '🇯🇲' },
    ],
  },
  E: {
    teams: [
      { name: 'Espagne', flag: '🇪🇸' },
      { name: 'Allemagne', flag: '🇩🇪' },
      { name: 'Corée du Sud', flag: '🇰🇷' },
      { name: 'Équateur', flag: '🇪🇨' },
    ],
  },
  F: {
    teams: [
      { name: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
      { name: 'Pays-Bas', flag: '🇳🇱' },
      { name: 'Sénégal', flag: '🇸🇳' },
      { name: 'Venezuela', flag: '🇻🇪' },
    ],
  },
  G: {
    teams: [
      { name: 'Portugal', flag: '🇵🇹' },
      { name: 'Belgique', flag: '🇧🇪' },
      { name: "Côte d'Ivoire", flag: '🇨🇮' },
      { name: 'Bolivie', flag: '🇧🇴' },
    ],
  },
  H: {
    teams: [
      { name: 'Croatie', flag: '🇭🇷' },
      { name: 'Uruguay', flag: '🇺🇾' },
      { name: 'Algérie', flag: '🇩🇿' },
      { name: 'Nouvelle-Zélande', flag: '🇳🇿' },
    ],
  },
  I: {
    teams: [
      { name: 'Italie', flag: '🇮🇹' },
      { name: 'Colombie', flag: '🇨🇴' },
      { name: 'Chili', flag: '🇨🇱' },
      { name: 'Iran', flag: '🇮🇷' },
    ],
  },
  J: {
    teams: [
      { name: 'Danemark', flag: '🇩🇰' },
      { name: 'Ghana', flag: '🇬🇭' },
      { name: 'Pérou', flag: '🇵🇪' },
      { name: 'Irak', flag: '🇮🇶' },
    ],
  },
  K: {
    teams: [
      { name: 'Turquie', flag: '🇹🇷' },
      { name: 'Nigeria', flag: '🇳🇬' },
      { name: 'Panama', flag: '🇵🇦' },
      { name: 'Jordanie', flag: '🇯🇴' },
    ],
  },
  L: {
    teams: [
      { name: 'Autriche', flag: '🇦🇹' },
      { name: 'Cameroun', flag: '🇨🇲' },
      { name: 'Costa Rica', flag: '🇨🇷' },
      { name: 'Ouzbékistan', flag: '🇺🇿' },
    ],
  },
}

const VENUES = [
  'MetLife Stadium, New York/NJ',
  'SoFi Stadium, Los Angeles',
  'AT&T Stadium, Dallas',
  "Levi's Stadium, San Francisco",
  'Mercedes-Benz Stadium, Atlanta',
  'Lumen Field, Seattle',
  'NRG Stadium, Houston',
  'Arrowhead Stadium, Kansas City',
  'Lincoln Financial Field, Philadelphie',
  'Hard Rock Stadium, Miami',
  'BMO Field, Toronto',
  'BC Place, Vancouver',
  'Estadio Azteca, Mexico City',
  'Estadio Akron, Guadalajara',
  'Estadio BBVA, Monterrey',
  'Gillette Stadium, Boston',
]

// Matchday 1 dates per group
const MD1_DATES = {
  A: '2026-06-11', B: '2026-06-12', C: '2026-06-12',
  D: '2026-06-13', E: '2026-06-13', F: '2026-06-14',
  G: '2026-06-14', H: '2026-06-15', I: '2026-06-15',
  J: '2026-06-16', K: '2026-06-16', L: '2026-06-17',
}
// Matchday 2 dates
const MD2_DATES = {
  A: '2026-06-18', B: '2026-06-19', C: '2026-06-19',
  D: '2026-06-20', E: '2026-06-20', F: '2026-06-21',
  G: '2026-06-21', H: '2026-06-22', I: '2026-06-22',
  J: '2026-06-23', K: '2026-06-23', L: '2026-06-24',
}
// Matchday 3 dates (simultaneous within group)
const MD3_DATES = {
  A: '2026-06-25', B: '2026-06-26', C: '2026-06-26',
  D: '2026-06-27', E: '2026-06-27', F: '2026-06-28',
  G: '2026-06-28', H: '2026-06-29', I: '2026-06-29',
  J: '2026-06-30', K: '2026-06-30', L: '2026-07-01',
}

const TIMES = ['14:00', '17:00', '20:00']

let matchCounter = 0
let venueCounter = 0

function nextVenue() {
  return VENUES[venueCounter++ % VENUES.length]
}

function makeGroupMatch(groupId, homeTeam, awayTeam, matchday, date, time) {
  matchCounter++
  const id = `m${String(matchCounter).padStart(3, '0')}`
  return {
    id,
    phase: 'group',
    group: groupId,
    matchday,
    homeTeam,
    awayTeam,
    date,
    time,
    venue: nextVenue(),
  }
}

// Round-robin pairings for 4 teams:
// MD1: [0v1, 2v3] | MD2: [0v2, 1v3] | MD3: [0v3, 1v2]
const PAIRINGS = [
  [[0, 1], [2, 3]],
  [[0, 2], [1, 3]],
  [[0, 3], [1, 2]],
]

const groupMatches = []
const groupKeys = Object.keys(GROUPS)

groupKeys.forEach((gid) => {
  const teams = GROUPS[gid].teams
  const md1Date = MD1_DATES[gid]
  const md2Date = MD2_DATES[gid]
  const md3Date = MD3_DATES[gid]

  // Matchday 1
  groupMatches.push(makeGroupMatch(gid, teams[0], teams[1], 1, md1Date, '17:00'))
  groupMatches.push(makeGroupMatch(gid, teams[2], teams[3], 1, md1Date, '20:00'))
  // Matchday 2
  groupMatches.push(makeGroupMatch(gid, teams[0], teams[2], 2, md2Date, '17:00'))
  groupMatches.push(makeGroupMatch(gid, teams[1], teams[3], 2, md2Date, '20:00'))
  // Matchday 3 (simultaneous — same time)
  groupMatches.push(makeGroupMatch(gid, teams[0], teams[3], 3, md3Date, '20:00'))
  groupMatches.push(makeGroupMatch(gid, teams[1], teams[2], 3, md3Date, '20:00'))
})

// 72 group stage matches generated above (matchCounter = 72)

// Knockout matches
function makeKnockoutMatch(phase, homeLabel, awayLabel, homeFlag, awayFlag, date, time) {
  matchCounter++
  const id = `m${String(matchCounter).padStart(3, '0')}`
  return {
    id,
    phase,
    homeTeam: { name: homeLabel, flag: homeFlag || '🏆' },
    awayTeam: { name: awayLabel, flag: awayFlag || '🏆' },
    date,
    time,
    venue: nextVenue(),
  }
}

const r32Matches = [
  makeKnockoutMatch('r32', '1er Groupe A', '2e Groupe B', '🇺🇸', '🇲🇦', '2026-07-04', '17:00'),
  makeKnockoutMatch('r32', '1er Groupe C', '2e Groupe D', '🇦🇷', '🇯🇵', '2026-07-04', '20:00'),
  makeKnockoutMatch('r32', '1er Groupe E', '2e Groupe F', '🇪🇸', '🇳🇱', '2026-07-05', '17:00'),
  makeKnockoutMatch('r32', '1er Groupe G', '2e Groupe H', '🇵🇹', '🇺🇾', '2026-07-05', '20:00'),
  makeKnockoutMatch('r32', '1er Groupe I', '2e Groupe J', '🇮🇹', '🇬🇭', '2026-07-06', '17:00'),
  makeKnockoutMatch('r32', '1er Groupe K', '2e Groupe L', '🇹🇷', '🇨🇲', '2026-07-06', '20:00'),
  makeKnockoutMatch('r32', '2e Groupe A', '1er Groupe B', '🇲🇽', '🇫🇷', '2026-07-07', '17:00'),
  makeKnockoutMatch('r32', '2e Groupe C', '1er Groupe D', '🇨🇦', '🇧🇷', '2026-07-07', '20:00'),
  makeKnockoutMatch('r32', '2e Groupe E', '1er Groupe F', '🇩🇪', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '2026-07-08', '14:00'),
  makeKnockoutMatch('r32', '2e Groupe G', '1er Groupe H', '🇧🇪', '🇭🇷', '2026-07-08', '17:00'),
  makeKnockoutMatch('r32', '2e Groupe I', '1er Groupe J', '🇨🇴', '🇩🇰', '2026-07-08', '20:00'),
  makeKnockoutMatch('r32', '2e Groupe K', '1er Groupe L', '🇳🇬', '🇦🇹', '2026-07-09', '17:00'),
  makeKnockoutMatch('r32', '3e #1', '3e #2', '🏆', '🏆', '2026-07-09', '20:00'),
  makeKnockoutMatch('r32', '3e #3', '3e #4', '🏆', '🏆', '2026-07-10', '17:00'),
  makeKnockoutMatch('r32', '3e #5', '3e #6', '🏆', '🏆', '2026-07-10', '20:00'),
  makeKnockoutMatch('r32', '3e #7', '3e #8', '🏆', '🏆', '2026-07-11', '17:00'),
]

const r16Matches = [
  makeKnockoutMatch('r16', 'Vainqueur HB1', 'Vainqueur HB2', '🏆', '🏆', '2026-07-12', '17:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB3', 'Vainqueur HB4', '🏆', '🏆', '2026-07-12', '20:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB5', 'Vainqueur HB6', '🏆', '🏆', '2026-07-13', '17:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB7', 'Vainqueur HB8', '🏆', '🏆', '2026-07-13', '20:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB9', 'Vainqueur HB10', '🏆', '🏆', '2026-07-14', '17:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB11', 'Vainqueur HB12', '🏆', '🏆', '2026-07-14', '20:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB13', 'Vainqueur HB14', '🏆', '🏆', '2026-07-15', '17:00'),
  makeKnockoutMatch('r16', 'Vainqueur HB15', 'Vainqueur HB16', '🏆', '🏆', '2026-07-15', '20:00'),
]

const qfMatches = [
  makeKnockoutMatch('qf', 'Vainqueur 1/8 A', 'Vainqueur 1/8 B', '🏆', '🏆', '2026-07-16', '17:00'),
  makeKnockoutMatch('qf', 'Vainqueur 1/8 C', 'Vainqueur 1/8 D', '🏆', '🏆', '2026-07-16', '20:00'),
  makeKnockoutMatch('qf', 'Vainqueur 1/8 E', 'Vainqueur 1/8 F', '🏆', '🏆', '2026-07-17', '17:00'),
  makeKnockoutMatch('qf', 'Vainqueur 1/8 G', 'Vainqueur 1/8 H', '🏆', '🏆', '2026-07-17', '20:00'),
]

const sfMatches = [
  makeKnockoutMatch('sf', 'Vainqueur QF 1', 'Vainqueur QF 2', '🏆', '🏆', '2026-07-14', '20:00'),
  makeKnockoutMatch('sf', 'Vainqueur QF 3', 'Vainqueur QF 4', '🏆', '🏆', '2026-07-15', '20:00'),
]

// Wait, SF dates should come after QF. Let me correct this inline:
sfMatches[0].date = '2026-07-18'
sfMatches[0].time = '20:00'
sfMatches[1].date = '2026-07-19'
sfMatches[1].time = '20:00'

const thirdMatch = makeKnockoutMatch('third', 'Perdant SF 1', 'Perdant SF 2', '🏆', '🏆', '2026-07-21', '20:00')

const finalMatch = makeKnockoutMatch('final', 'Vainqueur SF 1', 'Vainqueur SF 2', '🏆', '🏆', '2026-07-22', '20:00')

const demoMatch = {
  id: 'm000',
  phase: 'demo',
  homeTeam: { name: 'France', flag: '🇫🇷' },
  awayTeam: { name: 'Brésil', flag: '🇧🇷' },
  date: '2026-05-19',
  time: '20:00',
  venue: 'MetLife Stadium, New York/NJ',
}

const clFinalMatch = {
  id: 'mcl',
  phase: 'cl_final',
  homeTeam: { name: 'PSG', flag: '🇫🇷' },
  awayTeam: { name: 'Arsenal', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  date: '2026-05-30',
  time: '18:00',
  venue: 'Allianz Arena, Munich',
}

export const DEMO_RESULTS = {
  'm000': { homeScore: 2, awayScore: 1, winner: 'home' },
}

export const matches = [
  demoMatch,
  clFinalMatch,
  ...groupMatches,
  ...r32Matches,
  ...r16Matches,
  ...qfMatches,
  ...sfMatches,
  thirdMatch,
  finalMatch,
]

export const GROUPS_DATA = GROUPS

export function getPhaseLabel(phase) {
  const labels = {
    demo: 'Match de gala',
    cl_final: 'Finale Ligue des Champions',
    group: 'Phase de groupes',
    r32: 'Huitièmes de finale',
    r16: 'Huitièmes',
    qf: 'Quarts de finale',
    sf: 'Demi-finales',
    third: 'Match pour la 3e place',
    final: 'Finale',
  }
  return labels[phase] || phase
}

export function getPhaseBadgeColor(phase) {
  const colors = {
    demo: '#888',
    cl_final: '#1a56db',
    group: '#4f8ef7',
    r32: '#9b59b6',
    r16: '#8e44ad',
    qf: '#e67e22',
    sf: '#e74c3c',
    third: '#16a085',
    final: '#f0b429',
  }
  return colors[phase] || '#888'
}

export function getPointsForPhase(phase) {
  const pts = {
    group: 1,
    r32: 2,
    r16: 3,
    qf: 4,
    sf: 5,
    third: 3,
    final: 6,
  }
  return pts[phase] || 1
}

export function isKnockout(phase) {
  return ['r32', 'r16', 'qf', 'sf', 'third', 'final', 'cl_final'].includes(phase)
}

// For lookup by id
export const matchesById = Object.fromEntries(matches.map((m) => [m.id, m]))
