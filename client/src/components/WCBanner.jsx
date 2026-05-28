import { useMemo } from 'react'

// Coup d'envoi : 11 juin 2026, 21h00 heure de Paris (UTC+2)
const WC_START = new Date('2026-06-11T19:00:00Z')

export default function WCBanner() {
  const { days, hours, minutes, started } = useMemo(() => {
    const now = new Date()
    const diff = WC_START - now
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, started: true }
    const days    = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return { days, hours, minutes, started: false }
  }, [])

  return (
    <div className="wc-banner">
      <div className="wc-banner-inner">
        <img src="/wc-logo.png.png" alt="WC 2026" className="wc-banner-logo" />
        <span className="wc-banner-title">Coupe du Monde FIFA 26</span>
        <span className="wc-banner-divider" />
        {started ? (
          <span className="wc-banner-countdown wc-banner-countdown--live">En cours !</span>
        ) : (
          <span className="wc-banner-countdown">
            J<span className="wc-banner-sep">−</span>{days}
            <span className="wc-banner-sub">{String(hours).padStart(2,'0')}h{String(minutes).padStart(2,'0')}m</span>
          </span>
        )}
      </div>
    </div>
  )
}
