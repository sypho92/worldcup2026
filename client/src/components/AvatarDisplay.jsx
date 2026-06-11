/**
 * Renders either an emoji avatar or a circular photo (base64 / URL).
 * size = diameter in px for images; used as font-size multiplier for emoji.
 */
export function AvatarDisplay({ avatar, size = 36, className = '', onClick }) {
  const isImage = avatar?.startsWith('data:') || avatar?.startsWith('http')
  const clickable = !!onClick
  const style = clickable ? { cursor: 'pointer' } : undefined

  if (isImage) {
    return (
      <img
        src={avatar}
        alt="avatar"
        className={`avatar-img ${className}`}
        style={{ width: size, height: size, ...style }}
        onClick={onClick}
      />
    )
  }

  return (
    <span
      className={`avatar-emoji ${className}`}
      style={{ fontSize: Math.round(size * 0.78), lineHeight: 1, ...style }}
      onClick={onClick}
    >
      {avatar}
    </span>
  )
}
