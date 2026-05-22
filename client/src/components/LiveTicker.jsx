import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { matches } from '../data/mockData'
import { AvatarDisplay } from './AvatarDisplay'
import Flag from './Flag'
import { abbrev } from '../utils/format'
import QuickBetModal from './QuickBetModal'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SHOW_MS = 10_000   // item visible for 10s
const FADE_MS = 600      // fade-out transition
const REST_MS = 60_000   // 1 min silent gap between each item

export default function LiveTicker() {
  const { allBets, players, results, challenges, player } = useApp()

  const [current, setCurrent]     = useState(null)
  const [fading, setFading]       = useState(false)
  const [resting, setResting]     = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [quickBet, setQuickBet]   = useState(null)

  // Shuffled queue lives in a ref so it survives re-renders without triggering effects
  const queueRef = useRef([])
  const posRef   = useRef(0)

  // ── Build the item pool from live data ──────────────────────────────────────
  const items = useMemo(() => {
    const gageItems = []
    const betItems  = []

    // Gage challenges — most recent first
    Object.values(challenges).forEach((c) => {
      if (!c.gage || c.status === 'rejected') return
      const challenger = players[c.challengerId]
      const challenged = players[c.challengedId]
      const match = matches.find((m) => m.id === c.matchId)
      if (!challenger || !challenged || !match || results[c.matchId]) return
      gageItems.push({
        type: 'gage', matchId: c.matchId,
        challenger, challenged, match, gage: c.gage, createdAt: c.createdAt || 0,
      })
    })
    gageItems.sort((a, b) => b.createdAt - a.createdAt)

    // One item per (player, match) — skip own bets and finished matches
    const byPlayer = {}
    Object.entries(allBets).forEach(([pId, bets]) => {
      if (pId === player?.pseudoId) return
      const p = players[pId]
      if (!p) return
      Object.entries(bets).forEach(([matchId, outcome]) => {
        const match = matches.find((m) => m.id === matchId)
        if (!match || results[matchId]) return
        const team = outcome === 'home' ? match.homeTeam
                   : outcome === 'away' ? match.awayTeam
                   : null
        if (!byPlayer[pId]) byPlayer[pId] = []
        byPlayer[pId].push({ type: 'bet', matchId, player: p, match, outcome, team })
      })
    })

    // Round-robin interleave for max player variety
    const playerLists = Object.values(byPlayer).map(shuffle)
    const maxLen = Math.max(0, ...playerLists.map((l) => l.length))
    for (let i = 0; i < maxLen; i++) {
      playerLists.forEach((list) => {
        if (list[i]) betItems.push(list[i])
      })
    }

    return [...gageItems, ...betItems]
  }, [allBets, players, results, challenges, player])

  // ── Initialise queue when items become available for the first time ──────────
  useEffect(() => {
    if (items.length === 0 || dismissed) return
    if (queueRef.current.length === 0) {
      queueRef.current = shuffle([...items])
      posRef.current   = 0
      setCurrent(queueRef.current[0] || null)
    }
  }, [items.length, dismissed])

  // ── Main display timer — fires while an item is shown ───────────────────────
  useEffect(() => {
    if (!current || dismissed || resting) return

    const displayTimer = setTimeout(() => {
      setFading(true)

      const transitionTimer = setTimeout(() => {
        // After fade: hide the ticker and start the 1-min rest
        setCurrent(null)
        setFading(false)
        setResting(true)
      }, FADE_MS)

      return () => clearTimeout(transitionTimer)
    }, SHOW_MS)

    return () => clearTimeout(displayTimer)
  }, [current, dismissed, resting])

  // ── Rest period: 1-min silence, then advance to next item ──────────────────
  useEffect(() => {
    if (!resting || dismissed) return

    const restTimer = setTimeout(() => {
      if (items.length === 0) { setResting(false); return }

      // Advance position; reshuffle at end of cycle
      posRef.current += 1
      if (posRef.current >= queueRef.current.length) {
        queueRef.current = shuffle([...items])
        posRef.current   = 0
      }

      setResting(false)
      setCurrent(queueRef.current[posRef.current] || null)
    }, REST_MS)

    return () => clearTimeout(restTimer)
  }, [resting, dismissed, items])

  const handleClick = useCallback((item) => {
    setQuickBet({ matchId: item.matchId, playerId: item.type === 'bet' ? item.player.pseudoId : null })
  }, [])

  if (items.length === 0 || dismissed || !current) return null

  const isBet  = current.type === 'bet'
  const isGage = current.type === 'gage'

  return (
    <>
      <div className={`live-ticker${fading ? ' live-ticker--fading' : ''}`}>

        {/* Header bar */}
        <div className="live-ticker-bar">
          <span className="live-ticker-dot" />
          <span className="live-ticker-label">ACTIVITÉ</span>
          <button
            className="live-ticker-close"
            onClick={() => setDismissed(true)}
            title="Fermer"
          >✕</button>
        </div>

        {/* Item body */}
        <button className="live-ticker-body" onClick={() => handleClick(current)}>
          <div className="live-ticker-avatar-wrap">
            <AvatarDisplay
              avatar={isBet ? current.player.avatar : current.challenger.avatar}
              size={34}
            />
          </div>

          <div className="live-ticker-content">
            {isBet && (
              <>
                <div className="live-ticker-text">
                  <strong>{current.player.name}</strong>
                  {' mise sur '}
                  {current.team
                    ? <><Flag flag={current.team.flag} size={12} />{' '}<strong>{current.team.name}</strong></>
                    : <strong>Nul</strong>
                  }
                </div>
                <div className="live-ticker-sub">
                  {abbrev(current.match.homeTeam.name)} – {abbrev(current.match.awayTeam.name)}
                  {' · '}{current.match.time}
                </div>
              </>
            )}
            {isGage && (
              <>
                <div className="live-ticker-text">
                  <strong>{current.challenger.name}</strong>
                  {' défie '}
                  <strong>{current.challenged.name}</strong>
                </div>
                <div className="live-ticker-gage-text">📝 "{current.gage}"</div>
              </>
            )}
          </div>

          <span className="live-ticker-cta">{isGage ? '⚔' : '→'}</span>
        </button>
      </div>

      {quickBet && (
        <QuickBetModal
          matchId={quickBet.matchId}
          highlightPlayer={quickBet.playerId}
          onClose={() => setQuickBet(null)}
        />
      )}
    </>
  )
}
