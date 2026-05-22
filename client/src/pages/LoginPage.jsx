import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { resizeImageToBase64 } from '../utils/image'
import { AvatarDisplay } from '../components/AvatarDisplay'

const AVATARS = ['⚽', '🏆', '🦁', '🦅', '🐺', '🦊', '🐯', '🦋', '🌟', '🔥', '⚡', '🎯']

export default function LoginPage() {
  const { login, players } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [quickLoginId, setQuickLoginId] = useState(null)
  const fileRef = useRef(null)

  const existingPlayers = Object.entries(players || {})
    .map(([pseudoId, p]) => ({ pseudoId, ...p }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const base64 = await resizeImageToBase64(file)
      setAvatar(base64)
    } catch {
      setError("Impossible de charger l'image.")
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) { setError('Le pseudo doit faire au moins 2 caractères.'); return }
    if (trimmed.length > 20) { setError('Le pseudo doit faire au maximum 20 caractères.'); return }
    setError('')
    setLoading(true)
    try {
      await login(trimmed, avatar)
      navigate('/')
    } catch {
      setError('Erreur de connexion. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

  async function handleQuickLogin(p) {
    setQuickLoginId(p.pseudoId)
    try {
      await login(p.name, p.avatar)
      navigate('/')
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setQuickLoginId(null)
    }
  }

  const isImage = avatar?.startsWith('data:')

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">⚽</div>
          <h1>World Cup 2026</h1>
          <p>Pronostics entre amis</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="pseudo">Ton pseudo</label>
            <input
              id="pseudo"
              className="form-input"
              type="text"
              placeholder="ex: Thomas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Ton avatar</label>

            {/* Prévisualisation */}
            <div className="avatar-preview-row">
              <div className="avatar-preview-big">
                <AvatarDisplay avatar={avatar} size={52} />
              </div>
              <button type="button" className="btn-upload" onClick={() => fileRef.current?.click()}>
                📷 Importer une photo
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
            </div>

            {/* Grille emoji — grisée si une photo est importée */}
            <div className={`avatar-grid ${isImage ? 'avatar-grid--dimmed' : ''}`}>
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`avatar-btn ${avatar === a ? 'selected' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
        </form>

        {/* Connexion rapide : comptes existants */}
        {existingPlayers.length > 0 && (
          <div className="login-existing">
            <div className="login-existing-label">
              <span className="login-existing-line" />
              <span>ou rejoindre un compte existant</span>
              <span className="login-existing-line" />
            </div>
            <div className="login-existing-grid">
              {existingPlayers.map((p) => (
                <button
                  key={p.pseudoId}
                  className={`login-player-card ${quickLoginId === p.pseudoId ? 'loading' : ''}`}
                  onClick={() => handleQuickLogin(p)}
                  disabled={!!quickLoginId}
                  title={p.name}
                >
                  <div className="login-player-avatar">
                    <AvatarDisplay avatar={p.avatar} size={36} />
                    {quickLoginId === p.pseudoId && (
                      <div className="login-player-spinner" />
                    )}
                  </div>
                  <span className="login-player-name">{p.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
