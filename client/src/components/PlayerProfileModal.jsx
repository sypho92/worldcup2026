import { useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from './AvatarDisplay'

export default function PlayerProfileModal({ pseudoId, playerId, onClose }) {
  const id = pseudoId || playerId
  const { players, computePoints, scoreboard } = useApp()

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const playerData = players[id]
  const stats = useMemo(() => computePoints(id), [computePoints, id])
  const rank = useMemo(() => {
    const board = scoreboard()
    const idx = board.findIndex((p) => p.pseudoId === id)
    return idx === -1 ? null : idx + 1
  }, [scoreboard, id])

  if (!playerData) return null

  return (
    <div className="ppm-overlay" onClick={onClose}>
      <div className="ppm-card" onClick={(e) => e.stopPropagation()}>
        <button className="ppm-close" onClick={onClose}>✕</button>
        <AvatarDisplay avatar={playerData.avatar} size={64} />
        <h2 className="ppm-name">{playerData.name}</h2>
        {rank && <div className="ppm-rank">#{rank} au classement</div>}
        <div className="ppm-stats">
          <div className="ppm-stat">
            <span className="ppm-stat-val">{stats.total}</span>
            <span className="ppm-stat-lbl">pts</span>
          </div>
          <div className="ppm-stat">
            <span className="ppm-stat-val">{stats.correct}</span>
            <span className="ppm-stat-lbl">corrects</span>
          </div>
          <div className="ppm-stat">
            <span className="ppm-stat-val">{stats.wrong}</span>
            <span className="ppm-stat-lbl">ratés</span>
          </div>
        </div>
      </div>
    </div>
  )
}
