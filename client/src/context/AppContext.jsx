import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { ref, onValue, set, get, remove, update } from 'firebase/database'
import { db } from '../firebase'
import { getPointsForPhase } from '../utils/format'
import { getParisNow } from '../utils/time'

const AppContext = createContext(null)

function deriveGroupsData(matches) {
  const groups = {}
  matches
    .filter((m) => m.phase === 'group')
    .forEach((m) => {
      if (!groups[m.group]) groups[m.group] = new Map()
      groups[m.group].set(m.homeTeam.name, m.homeTeam)
      groups[m.group].set(m.awayTeam.name, m.awayTeam)
    })
  return Object.fromEntries(
    Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([g, teamsMap]) => [g, { teams: [...teamsMap.values()] }])
  )
}

function normalizeMatch(m) {
  if (!m.utcDate) return m
  const d = new Date(m.utcDate)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })
  return {
    ...m,
    date,
    time,
    homeTeam: { ...m.homeTeam, flag: m.homeTeam?.crest || null, shortName: m.homeTeam?.tla || m.homeTeam?.name || '???' },
    awayTeam: { ...m.awayTeam, flag: m.awayTeam?.crest || null, shortName: m.awayTeam?.tla || m.awayTeam?.name || '???' },
  }
}

export function AppProvider({ children }) {
  const [player, setPlayer] = useState(() => {
    try {
      const stored = localStorage.getItem('wc2026_player')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const [matches, setMatches] = useState([])
  const [matchesLoading, setMatchesLoading] = useState(true)
  const [myBets, setMyBets] = useState({})
  const [allBets, setAllBets] = useState({})
  const [players, setPlayers] = useState({})
  const [results, setResults] = useState({})
  const [challenges, setChallenges] = useState({})
  const [loading, setLoading] = useState(true)
  const [parisNow, setParisNow] = useState(getParisNow)

  useEffect(() => {
    const id = setInterval(() => setParisNow(getParisNow()), 30_000)
    return () => clearInterval(id)
  }, [])

  const isMatchLocked = useCallback(
    (match) => {
      if (!match.utcDate) return false
      // parisNow dep triggers re-evaluation every 30s so UI updates lock state in real time
      return Date.now() >= new Date(match.utcDate).getTime()
    },
    [parisNow]
  )

  // Matches + results from Firebase (single listener)
  useEffect(() => {
    const matchesRef = ref(db, 'matches')
    const unsub = onValue(matchesRef, (snap) => {
      const data = snap.val() || {}
      const arr = Object.values(data).map(normalizeMatch)
      setMatches(arr)

      const res = {}
      arr.forEach((m) => {
        if (m.result) res[m.id] = m.result
      })
      setResults(res)

      setMatchesLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const playersRef = ref(db, 'players')
    const unsub = onValue(playersRef, (snap) => {
      setPlayers(snap.val() || {})
      setLoading(false)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const betsRef = ref(db, 'bets')
    const unsub = onValue(betsRef, (snap) => {
      setAllBets(snap.val() || {})
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const challengesRef = ref(db, 'challenges')
    const unsub = onValue(challengesRef, (snap) => {
      setChallenges(snap.val() || {})
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!player) {
      setMyBets({})
      return
    }
    setMyBets(allBets[player.pseudoId] || {})
  }, [player, allBets])

  const matchesById = useMemo(
    () => Object.fromEntries(matches.map((m) => [m.id, m])),
    [matches]
  )

  const groupsData = useMemo(() => deriveGroupsData(matches), [matches])

  const login = useCallback(async (name, avatar) => {
    const pseudoId = name.toLowerCase().replace(/\s+/g, '_')
    const playerData = { name, avatar, createdAt: Date.now() }
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

  const updateProfile = useCallback(
    async ({ name, avatar }) => {
      if (!player) return
      const changes = {}
      if (name !== undefined) changes.name = name
      if (avatar !== undefined) changes.avatar = avatar
      await update(ref(db, `players/${player.pseudoId}`), changes)
      const stored = { ...player, ...changes }
      localStorage.setItem('wc2026_player', JSON.stringify(stored))
      setPlayer(stored)
    },
    [player]
  )

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

  const sendChallenge = useCallback(
    async ({ matchId, challengedId, type, gage }) => {
      if (!player) return
      const challengeId = `${matchId}_${player.pseudoId}_vs_${challengedId}`
      await set(ref(db, `challenges/${challengeId}`), {
        matchId,
        challengerId: player.pseudoId,
        challengedId,
        type,
        gage: gage || '',
        status: 'pending',
        createdAt: Date.now(),
      })
      return challengeId
    },
    [player]
  )

  const respondToChallenge = useCallback(async (challengeId, response) => {
    await update(ref(db, `challenges/${challengeId}`), { status: response })
  }, [])

  const deletePlayer = useCallback(
    async (pseudoId) => {
      const removals = [
        remove(ref(db, `players/${pseudoId}`)),
        remove(ref(db, `bets/${pseudoId}`)),
      ]
      Object.entries(challenges).forEach(([id, c]) => {
        if (c.challengerId === pseudoId || c.challengedId === pseudoId) {
          removals.push(remove(ref(db, `challenges/${id}`)))
        }
      })
      await Promise.all(removals)
    },
    [challenges]
  )

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
    [allBets, results, challenges, matches]
  )

  const scoreboard = useCallback(() => {
    return Object.entries(players)
      .map(([pseudoId, p]) => {
        const { total, correct, wrong } = computePoints(pseudoId)
        return {
          pseudoId,
          name: p.name,
          avatar: p.avatar,
          points: total,
          correctBets: correct,
          wrongBets: wrong,
        }
      })
      .sort((a, b) => b.points - a.points || b.correctBets - a.correctBets)
  }, [players, computePoints])

  const myPoints = useMemo(
    () => (player ? computePoints(player.pseudoId) : { total: 0, correct: 0, wrong: 0 }),
    [player, computePoints]
  )

  const myBetsCount = useMemo(() => Object.keys(myBets).length, [myBets])

  const playedCount = useMemo(
    () => matches.filter((m) => m.result !== null && m.result !== undefined).length,
    [matches]
  )

  return (
    <AppContext.Provider
      value={{
        player,
        login,
        logout,
        updateProfile,
        matches,
        matchesById,
        matchesLoading,
        groupsData,
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
