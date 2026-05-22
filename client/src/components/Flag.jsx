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
  if (flag?.startsWith('http') || flag?.startsWith('/')) {
    return (
      <img
        src={flag}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'inline-block' }}
      />
    )
  }
  const code = flagToCode(flag)
  if (code) {
    return (
      <span
        className={`fi fi-${code}`}
        style={{ fontSize: size, borderRadius: 3, flexShrink: 0 }}
      />
    )
  }
  return <span style={{ fontSize: size, lineHeight: 1, flexShrink: 0 }}>{flag}</span>
}
