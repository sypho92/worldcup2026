import { useState } from 'react'

export default function WatchPartyButton({ match, label = false }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  async function openParty(e) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    setError(false)

    // Ouvrir AVANT le fetch pour contourner le blocage popup navigateur
    const newWindow = window.open('', '_blank')

    try {
      const res = await fetch(`/api/watchparty/${match.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam: match.homeTeam, awayTeam: match.awayTeam }),
      })
      const data = await res.json()
      if (res.ok && data.inviteUrl) {
        newWindow.location.href = data.inviteUrl
      } else {
        newWindow.close()
        setError(true)
        setTimeout(() => setError(false), 3000)
      }
    } catch {
      newWindow.close()
      setError(true)
      setTimeout(() => setError(false), 3000)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className={`watch-party-btn${error ? ' error' : ''}`}
      onClick={openParty}
      disabled={loading}
      title="Clique pour ouvrir Discord et rejoindre la fan zone"
    >
      {loading ? '⏳ Ouverture...' : error ? '✕ Indispo' : label ? '📺 Regarder gratuitement avec les fans sur Discord' : '📺'}
    </button>
  )
}
