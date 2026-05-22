import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ref, onValue, set, get, remove, update } from 'firebase/database'
import { db } from '../firebase'
import { matches, getPointsForPhase, DEMO_RESULTS, DEMO_BETS } from '../data/mockData'
import { getParisNow } from '../utils/time'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    try {
      const stored = localStorage.getItem('wc2026_player')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [myBets, setMyBets] = useState({})
  const [allBets, setAllBets] = useState({})
  const [players, setPlayers] = useState({})
  const [results, setResults] = useState({})
  const [challenges, setChallenges] = useState({})
  const [loading, setLoading] = useState(true)
  const [parisNow, setParisNow] = useState(getParisNow)

  // Refresh Paris clock every 30s so locked state updates in real time
  useEffect(() => {
    const id = setInterval(() => setParisNow(getParisNow()), 30_000)
    return () => clearInterval(id)
  }, [])

  const isMatchLocked = useCallback(
    (match) => {
      if (!match.date || !match.time) return false
      if (parisNow.date > match.date) return true
      if (parisNow.date < match.date) return false
      return parisNow.time >= match.time
    },
    [parisNow]
  )

  // Subscribe to Firebase results
  useEffect(() => {
    const resultsRef = ref(db, 'matches')
    const unsub = onValue(resultsRef, (snap) => {
      const data = snap.val() || {}
      const res = {}
      Object.entries(data).forEach(([matchId, val]) => {
        if (val.result) res[matchId] = val.result
      })
      setResults({ ...DEMO_RESULTS, ...res })
    })
    return () => unsub()
  }, [])

  // Subscribe to all players
  useEffect(() => {
    const playersRef = ref(db, 'players')
    const unsub = onValue(playersRef, (snap) => {
      setPlayers(snap.val() || {})
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Subscribe to all bets
  useEffect(() => {
    const betsRef = ref(db, 'bets')
    const unsub = onValue(betsRef, (snap) => {
      setAllBets(snap.val() || {})
    })
    return () => unsub()
  }, [])

  // Subscribe to challenges
  useEffect(() => {
    const challengesRef = ref(db, 'challenges')
    const unsub = onValue(challengesRef, (snap) => {
      setChallenges(snap.val() || {})
    })
    return () => unsub()
  }, [])

  // Sync my bets when player changes or allBets updates
  useEffect(() => {
    if (!player) {
      setMyBets({})
      return
    }
    setMyBets({ ...DEMO_BETS, ...(allBets[player.pseudoId] || {}) })
  }, [player, allBets])

  const login = useCallback(async (name, avatar) => {
    const pseudoId = name.toLowerCase().replace(/\s+/g, '_')
    const playerData = { name, avatar, createdAt: Date.now() }

    // Create or retrieve player
    const playerRef = ref(db, `players/${pseudoId}`)
    const snap = await get(playerRef)
    if (!snap.exists()) {
      await set(playerRef, playerData)
    }

    const stored = { pseudoId, name: snap.exists() ? snap.val().name : name, avatar }
    localStorage.setItem('wc2026_player', JSON.stringify(stored))
    setPlayer(stored)
    return stored
  }, [])

  const updateProfile = useCallback(async ({ name, avatar }) => {
    if (!player) return
    const changes = {}
    if (name !== undefined) changes.name = name
    if (avatar !== undefined) changes.avatar = avatar
    await update(ref(db, `players/${player.pseudoId}`), changes)
    const stored = { ...player, ...changes }
    localStorage.setItem('wc2026_player', JSON.stringify(stored))
    setPlayer(stored)
  }, [player])

  const logout = useCallback(() => {
    localStorage.removeItem('wc2026_player')
    setPlayer(null)
    setMyBets({})
  }, [])

  const placeBet = useCallback(
    async (matchId, outcome) => {
      if (!player) return
      const betRef = ref(db, `bets/${player.pseudoId}/${matchId}`)
      if (myBets[matchId] === outcome) {
        await remove(betRef)
      } else {
        await set(betRef, outcome)
      }
    },
    [player, myBets]
  )

  // Send a challenge to another player for a specific match
  const sendChallenge = useCallback(
    async ({ matchId, challengedId, type, gage }) => {
      if (!player) return
      const challengeId = `${matchId}_${player.pseudoId}_vs_${challengedId}`
      await set(ref(db, `challenges/${challengeId}`), {
        matchId,
        challengerId: player.pseudoId,
        challengedId,
        type,        // 'double' | 'gage' | 'both'
        gage: gage || '',
        status: 'pending',
        createdAt: Date.now(),
      })
      return challengeId
    },
    [player]
  )

  // Accept or reject a challenge
  const respondToChallenge = useCallback(async (challengeId, response) => {
    await update(ref(db, `challenges/${challengeId}`), { status: response })
  }, [])

  // Delete a player account (admin only) — removes player, bets, and their challenges
  const deletePlayer = useCallback(async (pseudoId) => {
    const removals = [
      remove(ref(db, `players/${pseudoId}`)),
      remove(ref(db, `bets/${pseudoId}`)),
    ]
    // Remove challenges involving this player
    Object.entries(challenges).forEach(([id, c]) => {
      if (c.challengerId === pseudoId || c.challengedId === pseudoId) {
        removals.push(remove(ref(db, `challenges/${id}`)))
      }
    })
    await Promise.all(removals)
  }, [challenges])

  // Compute points for a given playerId (includes wrong count + double bonuses)
  const computePoints = useCallback(
    (pseudoId) => {
      const playerBets = allBets[pseudoId] || {}
      let total = 0
      let correct = 0
      let wrong = 0

      matches.forEach((m) => {
        const result = results[m.id]
        const bet = playerBets[m.id]
        if (!result || !bet) return
        if (bet === result.winner) {
          total += getPointsForPhase(m.phase)
          correct++
        } else {
          wrong++
        }
      })

      // Bonus point from accepted double challenges
      Object.values(challenges).forEach((challenge) => {
        if (challenge.status !== 'accepted') return
        if (challenge.type !== 'double' && challenge.type !== 'both') return
        if (challenge.challengerId !== pseudoId && challenge.challengedId !== pseudoId) return
        const result = results[challenge.matchId]
        if (!result) return
        const bet = playerBets[challenge.matchId]
        if (bet && bet === result.winner) total += 1
      })

      return { total, correct, wrong }
    },
    [allBets, results, challenges]
  )

  // Scoreboard: ranked list of all players with points
  const scoreboard = useCallback(() => {
    return Object.entries(players)
      .map(([pseudoId, p]) => {
        const { total, correct, wrong } = computePoints(pseudoId)
        return { pseudoId, name: p.name, avatar: p.avatar, points: total, correctBets: correct, wrongBets: wrong }
      })
      .sort((a, b) => b.points - a.points || b.correctBets - a.correctBets)
  }, [players, computePoints])

  const myPoints = player ? computePoints(player.pseudoId) : { total: 0, correct: 0, wrong: 0 }
  const myBetsCount = Object.keys(myBets).length
  const playedCount = Object.keys(results).length

  return (
    <AppContext.Provider
      value={{
        player,
        login,
        logout,
        updateProfile,
        myBets,
        allBets,
        players,
        results,
        challenges,
        loading,
        placeBet,
        sendChallenge,
        respondToChallenge,
        deletePlayer,
        computePoints,
        scoreboard,
        myPoints,
        myBetsCount,
        playedCount,
        isMatchLocked,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
