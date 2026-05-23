import { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from '../components/AvatarDisplay'
import { resizeImageToBase64 } from '../utils/image'
import ScheduleRow from '../components/ScheduleRow'

const AVATARS = ['⚽', '🏆', '🦁', '🦅', '🐺', '🦊', '🐯', '🦋', '🌟', '🔥', '⚡', '🎯']

// ─── Étapes de la compétition ─────────────────────────────────────────────────
const COMP_STAGES = [
  { key: 'group', short: 'Groupes' },
  { key: 'r32',   short: '32e' },
  { key: 'r16',   short: '16e' },
  { key: 'qf',    short: 'Quarts' },
  { key: 'sf',    short: 'Demies' },
  { key: 'third', short: '3e pl.' },
  { key: 'final', short: '🏆 Finale' },
]

function CompetitionStepper({ results }) {
  const { matches } = useApp()
  const statuses = COMP_STAGES.map((s) => {
    const stageMatches = matches.filter((m) => m.phase === s.key)
    if (stageMatches.length === 0) return { ...s, st: 'upcoming' }
    const played = stageMatches.filter((m) => results[m.id]).length
    if (played === stageMatches.length) return { ...s, st: 'done' }
    if (played > 0) return { ...s, st: 'current' }
    return { ...s, st: 'upcoming' }
  })

  // Si aucune étape n'est partiellement jouée, marquer la première non-terminée comme "current"
  if (!statuses.some((s) => s.st === 'current')) {
    const idx = statuses.findIndex((s) => s.st === 'upcoming')
    if (idx !== -1) statuses[idx] = { ...statuses[idx], st: 'current' }
  }

  return (
    <div className="comp-frise">
      {statuses.map((s, i) => (
        <div key={s.key} className="comp-frise-item" style={{ zIndex: statuses.length - i }}>
          <div className={`comp-frise-step comp-frise-step--${s.st}`}>
            {s.st === 'done' && <span className="comp-frise-check">✓</span>}
            <span className="comp-frise-label">{s.short}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Groupe les matchs par date (string YYYY-MM-DD)
function groupByDate(matchList) {
  const map = {}
  matchList.forEach((m) => {
    if (!map[m.date]) map[m.date] = []
    map[m.date].push(m)
  })
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const now = new Date()
  const yesterday = new Date(now)
  const tomorrow = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  tomorrow.setDate(now.getDate() + 1)

  if (d.toDateString() === now.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === yesterday.toDateString()) return 'Hier'
  if (d.toDateString() === tomorrow.toDateString()) return 'Demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function isDateToday(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toDateString() === new Date().toDateString()
}

// ─── Section de date ─────────────────────────────────────────────────────────

function DateSection({ dateStr, dayMatches, nextMatchId }) {
  const today = isDateToday(dateStr)
  const header = formatDateHeader(dateStr)

  return (
    <div className="sched-section">
      <div className={`sched-date-header ${today ? 'sched-date-header--today' : ''}`}>
        {header}
      </div>

      {dayMatches.length === 0 ? (
        <div className="sched-empty">
          <strong>Aucun match prévu aujourd'hui</strong>
          <span>on s'emmerde</span>
        </div>
      ) : (
        <div className="sched-day">
          {dayMatches.map((m, i) => (
            <div key={m.id}>
              <NextMatchCountdown targetMatchId={m.id} />
              <ScheduleRow match={m} entryDelay={i * 0.07} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal édition profil ─────────────────────────────────────────────────────

function ProfileEditModal({ onClose }) {
  const { player, updateProfile } = useApp()
  const [avatar, setAvatar] = useState(player?.avatar || AVATARS[0])
  const [name, setName] = useState(player?.name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

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

  async function handleSave() {
    const trimmed = name.trim()
    if (trimmed.length < 2) { setError('Le pseudo doit faire au moins 2 caractères.'); return }
    if (trimmed.length > 20) { setError('Le pseudo doit faire au maximum 20 caractères.'); return }
    setSaving(true)
    setError('')
    try {
      await updateProfile({ name: trimmed, avatar })
      onClose()
    } catch {
      setError('Erreur lors de la sauvegarde.')
      setSaving(false)
    }
  }

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isImage = avatar?.startsWith('data:')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Mon profil</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Avatar preview */}
        <div className="profile-avatar-preview">
          <div className="profile-avatar-big">
            <AvatarDisplay avatar={avatar} size={72} />
          </div>
        </div>

        {/* Upload photo */}
        <div className="profile-section">
          <label className="form-label">Avatar</label>
          <button type="button" className="btn-upload" onClick={() => fileRef.current?.click()}>
            📷 Importer une photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />

          <div className={`avatar-grid avatar-grid--compact ${isImage ? 'avatar-grid--dimmed' : ''}`}>
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

        {/* Pseudo */}
        <div className="profile-section">
          <label className="form-label">Pseudo</label>
          <input
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoComplete="off"
          />
        </div>

        {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Décompte prochain match ─────────────────────────────────────────────────

function formatCountdown(diffMs) {
  if (diffMs <= 0) return null
  const totalSec = Math.floor(diffMs / 1000)
  const totalMin = Math.floor(totalSec / 60)
  const totalH   = Math.floor(totalSec / 3600)
  const d = Math.floor(totalH / 24)
  const h = totalH % 24
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60

  // > 24h → jours + heures
  if (totalH >= 24) return `${d}j ${h}h`
  // > 1h → heures + minutes
  if (totalH >= 1)  return `${totalH}h ${String(m).padStart(2, '0')}m`
  // > 1min → minutes + secondes
  if (totalMin >= 1) return `${totalMin}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// Renvoie l'ID du prochain match non commencé
function useNextMatchId() {
  const { isMatchLocked, matches } = useApp()
  return useMemo(() => {
    return matches
      .filter((m) => m.date && m.time && !isMatchLocked(m))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0]?.id ?? null
  }, [isMatchLocked, matches])
}

// Bandeau décompte — ne s'affiche que si targetMatchId est le prochain match
function NextMatchCountdown({ targetMatchId }) {
  const nextMatchId = useNextMatchId()
  const { matchesById } = useApp()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!nextMatchId || nextMatchId !== targetMatchId) return null

  const nextMatch = matchesById[nextMatchId]
  if (!nextMatch) return null

  const matchTs = new Date(`${nextMatch.date}T${nextMatch.time}:00+02:00`).getTime()
  const diff = matchTs - now
  const label = formatCountdown(diff)
  if (!label) return null

  const isHot = diff < 3 * 3600 * 1000

  return (
    <div className={`sched-countdown sched-countdown--inline${isHot ? ' sched-countdown--hot' : ''}`}>
      <span className="sched-countdown-next">⏱ PROCHAIN MATCH</span>
      <span className="sched-countdown-time">{label}</span>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function HomePage() {
  const { player, myPoints, myBetsCount, playedCount, scoreboard, results, matches } = useApp()
  const [filter, setFilter] = useState('all')
  const [showProfile, setShowProfile] = useState(false)
  const todayRef = useRef(null)

  const rank = useMemo(() => {
    const board = scoreboard()
    const idx = board.findIndex((p) => p.pseudoId === player?.pseudoId)
    return idx === -1 ? '—' : idx + 1
  }, [scoreboard, player])

  const filteredMatches = useMemo(() => {
    if (filter === 'upcoming') return matches.filter((m) => !results[m.id])
    if (filter === 'played') return matches.filter((m) => results[m.id])
    return matches
  }, [filter, results])

  const today = new Date().toISOString().split('T')[0]
  const byDate = groupByDate(filteredMatches)
  const hasTodaySection = byDate.some(([d]) => d === today)
  const sections = hasTodaySection
    ? byDate
    : [
        ...byDate.filter(([d]) => d < today),
        [today, []],
        ...byDate.filter(([d]) => d > today),
      ]

  const stickyRef = useRef(null)

  useEffect(() => {
    if (!todayRef.current) return
    const stickyHeight = stickyRef.current ? stickyRef.current.offsetHeight : 0
    const top = todayRef.current.getBoundingClientRect().top + window.scrollY - stickyHeight
    window.scrollTo(0, Math.max(0, top))
  }, [])

  return (
    <div className="page sched-page">
      {showProfile && <ProfileEditModal onClose={() => setShowProfile(false)} />}

      {/* ── En-tête sticky ── */}
      <div className="sched-sticky-top" ref={stickyRef}>

        {/* Logo mobile uniquement */}
        <div className="sched-mobile-logo">
          <img src="/logo.png" alt="Pronos du Peuple" className="sched-mobile-logo-img" />
        </div>

        {/* Header compact */}
        <div className="sched-header">
          <button className="sched-greeting" onClick={() => setShowProfile(true)}>
            <span className="sched-avatar">
              <AvatarDisplay avatar={player?.avatar} size={38} />
            </span>
            <div>
              <div className="sched-greeting-name">{player?.name}</div>
              <div className="sched-greeting-sub">Modifier le profil</div>
            </div>
          </button>

          <div className="sched-stats">
            <div className="sched-stat">
              <span className="sched-stat-val">{myPoints.total}</span>
              <span className="sched-stat-lbl">pts</span>
            </div>
            <div className="sched-stat-div" />
            <div className="sched-stat">
              <span className="sched-stat-val sched-stat-val--correct">{myPoints.correct}</span>
              <span className="sched-stat-lbl">gagnés</span>
            </div>
            <div className="sched-stat-div" />
            <div className="sched-stat">
              <span className="sched-stat-val sched-stat-val--wrong">{myPoints.wrong}</span>
              <span className="sched-stat-lbl">perdus</span>
            </div>
            <div className="sched-stat-div" />
            <div className="sched-stat">
              <span className="sched-stat-val">{rank}</span>
              <span className="sched-stat-lbl">rang</span>
            </div>
          </div>
        </div>

        {/* Fil d'ariane de la compétition */}
        <CompetitionStepper results={results} />

        {/* Filtres */}
        <div className="sched-filters">
          {[
            { key: 'all', label: 'Tous' },
            { key: 'upcoming', label: 'À venir' },
            { key: 'played', label: 'Joués' },
          ].map((f) => (
            <button
              key={f.key}
              className={`sched-filter ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Schedule par date ── */}
      <div className="sched-list">
        {sections.map(([dateStr, dayMatches]) => (
          <div key={dateStr} ref={dateStr === today ? todayRef : null}>
            <DateSection dateStr={dateStr} dayMatches={dayMatches} />
          </div>
        ))}
      </div>

    </div>
  )
}
