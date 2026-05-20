import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const AVATARS = ['⚽', '🏆', '🦁', '🦅', '🐺', '🦊', '🐯', '🦋', '🌟', '🔥', '⚡', '🎯']

export default function LoginPage() {
  const { login } = useApp()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
    } catch (err) {
      setError('Erreur de connexion. Vérifiez votre connexion.')
    } finally {
      setLoading(false)
    }
  }

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
            <div className="avatar-grid">
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
      </div>
    </div>
  )
}
