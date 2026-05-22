/**
 * Abbreviates a team name to 3 uppercase characters.
 * Single word: first 3 letters. Multiple words: initials.
 */
export function abbrev(name) {
  const words = name.split(' ')
  if (words.length === 1) return name.slice(0, 3).toUpperCase()
  return words.map((w) => w[0]).join('').toUpperCase().slice(0, 3)
}
