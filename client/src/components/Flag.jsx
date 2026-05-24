// Derives a 2-letter ISO country code from a flag emoji using Unicode regional
// indicator math (U+1F1E6–U+1F1FF map to A–Z). England's subdivisional flag
// 🏴󠁧󠁢󠁥󠁮󠁧󠁿 uses tag characters instead, so it's handled as a special case.
function flagToCode(emoji) {
  if (!emoji) return null
  if (emoji === '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}') return 'gb-eng'
  try {
    const chars = [...emoji]
    if (chars.length < 2) return null
    const a = chars[0].codePointAt(0)
    const b = chars[1].codePointAt(0)
    if (a < 0x1F1E6 || a > 0x1F1FF || b < 0x1F1E6 || b > 0x1F1FF) return null
    return String.fromCharCode(a - 0x1F1E6 + 65, b - 0x1F1E6 + 65).toLowerCase()
  } catch {
    return null
  }
}

export default function Flag({ flag, size = 20 }) {
  // Conteneur commun — taille fixe, centrage garanti dans n'importe quel contexte
  const wrap = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    flexShrink: 0,
  }

  if (flag?.startsWith('http') || flag?.startsWith('/')) {
    return (
      <span style={wrap}>
        <img
          src={flag}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </span>
    )
  }

  const code = flagToCode(flag)
  if (code) {
    // fi-xx utilise background-image ; on lui impose la hauteur et laisse le ratio 4:3
    return (
      <span style={{ ...wrap, width: 'auto' }}>
        <span
          className={`fi fi-${code}`}
          style={{
            display: 'block',
            width: Math.round(size * 1.33),
            height: size,
            backgroundSize: 'cover',
            backgroundPosition: '50%',
            borderRadius: 3,
            flexShrink: 0,
          }}
        />
      </span>
    )
  }

  return (
    <span style={wrap}>
      <span style={{ fontSize: size * 0.9, lineHeight: 1 }}>{flag}</span>
    </span>
  )
}
