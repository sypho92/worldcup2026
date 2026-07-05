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

// Table canonique nom/tla → drapeau, construite depuis la phase de groupes
// (chaque nation y figure avec son drapeau correct). Source de vérité unique :
// peu importe ce que le backend écrit dans les slots à élimination directe, le
// drapeau AFFICHÉ est toujours celui de l'équipe portant ce nom → impossible
// d'avoir un drapeau inversé.
function buildFlagRegistry(matchesObj) {
  const byName = {}
  const byTla = {}
  Object.values(matchesObj).forEach((m) => {
    if (m.phase !== 'group') return
    ;[m.homeTeam, m.awayTeam].forEach((t) => {
      const flag = t?.flag || t?.crest
      if (t?.name && flag && !byName[t.name]) byName[t.name] = flag
      if (t?.tla && flag && !byTla[t.tla]) byTla[t.tla] = flag
    })
  })
  return { byName, byTla }
}

// Résout le drapeau d'une équipe par son identité (nom → tla → valeur stockée)
function resolveFlag(team, registry) {
  if (!team) return null
  return (
    (team.name && registry.byName[team.name]) ||
    (team.tla && registry.byTla[team.tla]) ||
    team.flag || team.crest || null
  )
}

function normalizeMatch(m, registry = { byName: {}, byTla: {} }) {
  const homeTeam = { ...m.homeTeam, flag: resolveFlag(m.homeTeam, registry), shortName: m.homeTeam?.tla || m.homeTeam?.name || '???' }
  const awayTeam = { ...m.awayTeam, flag: resolveFlag(m.awayTeam, registry), shortName: m.awayTeam?.tla || m.awayTeam?.name || '???' }

  if (!m.utcDate) {
    // Pas de date API : on conserve date/time existants si présents, sinon placeholder
    return {
      ...m,
      homeTeam,
      awayTeam,
      date: m.date || null,
      time: m.time || null,
    }
  }

  const d = new Date(m.utcDate)
  const date = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const time = d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hour12: false })
  return { ...m, date, time, homeTeam, awayTeam }
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
  const [scoreboardSnapshot, setScoreboardSnapshot] = useState({})
  const [loading, setLoading] = useState(true)
  const [parisNow, setParisNow] = useState(getParisNow)

  useEffect(() => {
    const id = setInterval(() => setParisNow(getParisNow()), 30_000)
    return () => clearInterval(id)
  }, [])

  const isMatchLocked = useCallback(
    (match) => {
      if (!match.utcDate) return false
      // Lock if match has started (parisNow dep triggers re-eval every 30s)
      if (Date.now() >= new Date(match.utcDate).getTime()) return true
      // Lock if an accepted challenge involves the current player on this match
      // BUT only if the player has already placed a bet — a challenge must never
      // prevent placing a first bet, only changing an existing one.
      if (player) {
        const hasAcceptedChallenge = Object.values(challenges).some(
          (c) =>
            c.matchId === match.id &&
            (c.status === 'accepted' || c.status === 'cancel_requested') &&
            (c.challengerId === player.pseudoId || c.challengedId === player.pseudoId)
        )
        if (hasAcceptedChallenge && myBets[match.id]) return true
      }
      return false
    },
    [parisNow, challenges, player, myBets]
  )

  // Matches + results from Firebase (single listener)
  useEffect(() => {
    const matchesRef = ref(db, 'matches')
    const unsub = onValue(matchesRef, (snap) => {
      const data = snap.val() || {}
      const flagRegistry = buildFlagRegistry(data)
      const arr = Object.values(data).map((m) => normalizeMatch(m, flagRegistry))
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
    const snapshotRef = ref(db, 'scoreboard_snapshot')
    const unsub = onValue(snapshotRef, (snap) => {
      setScoreboardSnapshot(snap.val() || {})
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
      if (type === 'double') {
        const myBet = (allBets[player.pseudoId] || {})[matchId]
        const theirBet = (allBets[challengedId] || {})[matchId]
        if (myBet && theirBet && myBet === theirBet) throw new Error('Même pari — défi impossible')

        const ACTIVE = ['pending', 'accepted', 'cancel_requested']
        const hasDouble = Object.values(challenges).some(
          (c) =>
            c.matchId === matchId &&
            c.type === 'double' &&
            ACTIVE.includes(c.status) &&
            (c.challengerId === player.pseudoId || c.challengedId === player.pseudoId ||
             c.challengerId === challengedId || c.challengedId === challengedId)
        )
        if (hasDouble) throw new Error('Un quitte ou double actif existe déjà sur ce match')
      }
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
    [player, challenges]
  )

  const respondToChallenge = useCallback(async (challengeId, response) => {
    const challenge = challenges[challengeId]
    // Un quitte ou double doit être accepté AVANT le coup d'envoi.
    // Si le match a démarré (ou est terminé), l'acceptation est invalide → expiré.
    if (response === 'accepted' && challenge) {
      const match = matchesById[challenge.matchId]
      const started = match?.utcDate && Date.now() >= new Date(match.utcDate).getTime()
      const finished = match && !!results[challenge.matchId]
      if (started || finished) {
        await update(ref(db, `challenges/${challengeId}`), { status: 'expired' })
        throw new Error('Match déjà commencé — le défi a expiré')
      }
    }
    await update(ref(db, `challenges/${challengeId}`), { status: response })
  }, [challenges, matchesById, results])

  const requestCancelChallenge = useCallback(async (challengeId) => {
    if (!player) return
    await update(ref(db, `challenges/${challengeId}`), {
      status: 'cancel_requested',
      cancelRequestedBy: player.pseudoId,
    })
  }, [player])

  const respondToCancelChallenge = useCallback(async (challengeId, accept) => {
    if (accept) {
      await update(ref(db, `challenges/${challengeId}`), { status: 'cancelled' })
    } else {
      await update(ref(db, `challenges/${challengeId}`), {
        status: 'accepted',
        cancelRequestedBy: null,
      })
    }
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
          total += 1
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
        if (!bet) return
        if (bet === result.winner) total += 1
        else total -= 1
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
      .sort((a, b) => b.points - a.points || b.correctBets - a.correctBets || (b.correctBets + b.wrongBets) - (a.correctBets + a.wrongBets))
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
        scoreboardSnapshot,
        loading,
        placeBet,
        sendChallenge,
        respondToChallenge,
        requestCancelChallenge,
        respondToCancelChallenge,
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
