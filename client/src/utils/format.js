/**
 * Abbreviates a team name to 3 uppercase characters.
 * Single word: first 3 letters. Multiple words: initials.
 */
export function abbrev(name) {
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
  return 1
}

export function isKnockout(phase) {
  return ['r32', 'r16', 'qf', 'sf', 'third', 'final', 'cl_final'].includes(phase)
}
