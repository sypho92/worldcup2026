import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

const DISPLAY_MS = 8000

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem('fun_notifs_seen') || '[]')) } catch { return new Set() }
}
function persistSeen(set) {
  try { localStorage.setItem('fun_notifs_seen', JSON.stringify([...set].slice(-300))) } catch {}
}

export default function FunNotifications() {
  const { results, allBets, matches, scoreboard, players } = useApp()
  const [toasts, setToasts] = useState([])
  const seenRef    = useRef(loadSeen())
  const prevRes    = useRef(null)   // null = first render
  const prevBoard  = useRef([])

  useEffect(() => {
    // First render — set baseline silently
    if (prevRes.current === null) {
      prevRes.current = { ...results }
      prevBoard.current = scoreboard()
      return
    }

    const newIds = Object.keys(results).filter(id => !prevRes.current[id])
    if (newIds.length === 0) return

    let delay = 0

    const push = (notifId, msg, emoji = '📊') => {
      if (seenRef.current.has(notifId)) return
      seenRef.current.add(notifId)
      persistSeen(seenRef.current)
      const toastId = `${notifId}_${Date.now() + delay}`
      setTimeout(() => {
        setToasts(prev => {
          const next = [...prev, { id: toastId, msg, emoji }]
          return next.slice(-3) // max 3 visible
        })
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== toastId)), DISPLAY_MS)
      }, delay)
      delay += 900
    }

    // ── 1. Analyse de chaque nouveau résultat ────────────────────────────────
    for (const matchId of newIds) {
      const result = results[matchId]
      const match  = matches.find(m => m.id === matchId)
      if (!match || !result) continue

      const slots = { home: [], draw: [], away: [] }
      Object.entries(allBets).forEach(([pid, pb]) => {
        const b = pb[matchId]
        if (b && slots[b] !== undefined) slots[b].push(pid)
      })
      const total        = slots.home.length + slots.draw.length + slots.away.length
      const winnerSlot   = slots[result.winner] || []

      if (total > 0) {
        if (winnerSlot.length === 0) {
          push(`no_one_${matchId}`, "Personne n'avait prévu ça. Les pronostiqueurs pleurent en silence", '😭')
        } else if (winnerSlot.length === 1) {
          const solo = players[winnerSlot[0]]
          if (solo) push(`lone_wolf_${matchId}`, `${solo.name} était le seul à avoir vu juste. Génie ou chance, on ne saura jamais`, '🧠')
        } else {
          const loserSide = result.winner === 'home' ? 'away' : result.winner === 'away' ? 'home' : null
          if (loserSide) {
            const loserPct = Math.round((slots[loserSide].length / total) * 100)
            if (loserPct >= 50) {
              const teamName = loserSide === 'home' ? match.homeTeam.name : match.awayTeam.name
              push(`pop_loser_${matchId}`, `${loserPct}% avaient misé sur ${teamName}. Ils savent tous ensemble se planter`, '💸')
            }
          }
        }
      }
    }

    // ── 2. Séries par joueur ─────────────────────────────────────────────────
    const finishedByDate = matches
      .filter(m => results[m.id])
      .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))

    const triggerMatch = newIds[newIds.length - 1]

    Object.entries(allBets).forEach(([pid, pb]) => {
      const p = players[pid]
      if (!p) return

      const boolResults = finishedByDate
        .filter(m => pb[m.id] && results[m.id])
        .map(m => pb[m.id] === results[m.id].winner)

      if (boolResults.length < 2) return

      let ws = 0, ls = 0
      for (let i = boolResults.length - 1; i >= 0; i--) {
        if (boolResults[i]) { if (ls > 0) break; ws++ }
        else                { if (ws > 0) break; ls++ }
      }

      if      (ws === 3)           push(`ws3_${pid}_${triggerMatch}`,   `${p.name} est sur une série de 3 bons pronostics. Il aurait dû mettre son PEL`, '🔥')
      else if (ws === 4 || ws === 5) push(`ws${ws}_${pid}_${triggerMatch}`, `${p.name} enchaîne ${ws} bons pronostics. Il débutera au Canal Football Club la saison prochaine`, '📺')
      else if (ws >= 6)            push(`ws${ws}_${pid}_${triggerMatch}`, `${p.name} est en feu : ${ws} bons de suite. Quelqu'un vérifie ses sources ?`, '🔥')
      else if (ls === 2)           push(`ls2_${pid}_${triggerMatch}`,   `${p.name} est sur 2 mauvais pronostics. Il faut se resaisir, champion`, '📉')
      else if (ls === 3)           push(`ls3_${pid}_${triggerMatch}`,   `${p.name} n'a rien eu depuis 3 matchs. C'est un talent rare`, '🪦')
      else if (ls >= 5 && ls % 2 === 1) push(`ls${ls}_${pid}_${triggerMatch}`, `${p.name} est sur une série de ${ls} défaites. Ça sent la relégation`, '🚨')
    })

    // ── 3. Classement ────────────────────────────────────────────────────────
    const board = scoreboard()
    const prev  = prevBoard.current
    const tid   = newIds[0]

    if (prev.length > 0 && board.length >= 2) {
      const curFirst = board[0]
      const prvFirst = prev[0]
      const curLast  = board[board.length - 1]
      const prvLast  = prev[prev.length - 1]
      const totalRes = Object.keys(results).length

      // Nouveau leader
      if (curFirst && prvFirst && curFirst.pseudoId !== prvFirst.pseudoId)
        push(`new_first_${curFirst.pseudoId}_${tid}`, `${curFirst.name} décolle au classement, il a enfin regardé un match de foot`, '🚀')
      // Toujours en tête (toutes les 7 résultats)
      else if (curFirst && prvFirst && curFirst.pseudoId === prvFirst.pseudoId && totalRes % 7 === 0)
        push(`still_first_${curFirst.pseudoId}_${totalRes}`, `${curFirst.name} reste en tête. On commence à se demander s'il a une source`, '👑')

      // Nouveau dernier
      if (curLast && prvLast && curLast.pseudoId !== prvLast.pseudoId) {
        const secondLast = board[board.length - 2]
        const msgs = secondLast
          ? [`${curLast.name} est passé dernier au classement, il a réussi à faire pire que ${secondLast.name} (avant-dernier)`,
             `${curLast.name} passe en dernière place. C'est une place faite pour lui`]
          : [`${curLast.name} s'installe en dernière place`]
        push(`new_last_${curLast.pseudoId}_${tid}`, msgs[Math.floor(Math.random() * msgs.length)], '😬')
      }
      // Toujours dernier (toutes les 5 résultats)
      else if (curLast && prvLast && curLast.pseudoId === prvLast.pseudoId && totalRes % 5 === 0)
        push(`still_last_${curLast.pseudoId}_${totalRes}`, `${curLast.name} reste bon dernier et ça ne le dérange pas`, '🏳️')

      // Gros bond (≥ 2 places)
      board.forEach((p, newIdx) => {
        const oldIdx = prev.findIndex(x => x.pseudoId === p.pseudoId)
        if (oldIdx < 0 || newIdx >= oldIdx || oldIdx - newIdx < 2) return
        const fallen = prev[newIdx]
        const fallenP = fallen ? players[fallen.pseudoId] : null
        const msg = fallenP
          ? `${p.name} vient de doubler ${fallenP.name}. La vengeance est froide et elle arrive`
          : `${p.name} décolle au classement`
        push(`overtake_${p.pseudoId}_${tid}`, msg, '⚡')
      })

      // Comeback (après ≥ 3 pertes, 1 victoire)
      Object.entries(allBets).forEach(([pid, pb]) => {
        const pl = players[pid]
        if (!pl) return
        const boolRes = finishedByDate
          .filter(m => pb[m.id] && results[m.id])
          .map(m => pb[m.id] === results[m.id].winner)
        if (boolRes.length < 4) return
        const last = boolRes[boolRes.length - 1]
        if (!last) return
        // count losses just before the last win
        let streak = 0
        for (let i = boolRes.length - 2; i >= 0; i--) {
          if (!boolRes[i]) streak++; else break
        }
        if (streak >= 3)
          push(`comeback_${pid}_${triggerMatch}`, `Après ${streak} défaites, ${pl.name} repasse dans le vert. La machine se remet en route`, '🔄')
      })
    }

    prevRes.current   = { ...results }
    prevBoard.current = board
  }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  if (toasts.length === 0) return null

  return (
    <div className="fun-notifs">
      {toasts.map(t => (
        <div key={t.id} className="fun-notif">
          <span className="fun-notif-emoji">{t.emoji}</span>
          <span className="fun-notif-msg">{t.msg}</span>
          <button
            className="fun-notif-dismiss"
            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
          >✕</button>
        </div>
      ))}
    </div>
  )
}
