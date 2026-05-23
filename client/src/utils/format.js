/**
 * Abbreviates a team name to 3 uppercase characters.
 * Single word: first 3 letters. Multiple words: initials.
 */
export function abbrev(nameOrTeam) {
  if (!nameOrTeam) return '???'
  if (typeof nameOrTeam === 'object') {
    return nameOrTeam.shortName || nameOrTeam.tla || abbrev(nameOrTeam.name)
  }
  const name = nameOrTeam
  const words = name.split(' ')
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3)
}

export function getPhaseLabel(phase) {
  const labels = {
    demo: 'Match de gala',
    cl_final: 'Finale Ligue des Champions',
    liga: 'La Liga',
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
    liga: '#e11d48',
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
  const pts = { group: 1, demo: 1, liga: 1, cl_final: 1, r32: 2, r16: 3, qf: 4, sf: 5, third: 3, final: 6 }
  return pts[phase] ?? 1
}

export function isKnockout(phase) {
  return ['r32', 'r16', 'qf', 'sf', 'third', 'final', 'cl_final'].includes(phase)
}
