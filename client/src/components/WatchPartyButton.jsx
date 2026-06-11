import { useState } from 'react'

export default function WatchPartyButton({ match, label = false }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Visible uniquement pour les matchs du jour
  const today = new Date().toLocaleDateString('en-CA')
  if (match.date !== today) return null

  async function openParty(e) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/watchparty/${match.id}`, { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.inviteUrl) {
        window.open(data.inviteUrl, '_blank')
      } else {
        setError(true)
        setTimeout(() => setError(false), 3000)
      }
    } catch {
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
      {loading ? '⏳ Ouverture...' : error ? '✕ Indispo' : label ? '👁 Fan zone · Clique pour ouvrir Discord' : '👁'}
    </button>
  )
}
