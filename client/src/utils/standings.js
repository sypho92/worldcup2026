// Pure utility — computes FIFA 2026 group standings with official tiebreaker criteria

export function computeGroupStandings(teams, groupMatches, results) {
  // Build stats per team
  const stats = {}
  teams.forEach((t) => {
    stats[t.name] = {
      team: t,
      played: 0, won: 0, drawn: 0, lost: 0,
      gf: 0, ga: 0, gd: 0, pts: 0,
      // head-to-head record vs each opponent (populated below)
      h2h: {},
      fairPlay: 0, // negative: yellow=-1, indirect red=-2, direct red=-3
    }
  })

  // Process results
  groupMatches.forEach((m) => {
    const r = results[m.id]
    if (!r) return

    const hs = r.homeScore
    const as = r.awayScore
    const home = m.homeTeam.name
    const away = m.awayTeam.name

    if (!stats[home] || !stats[away]) return

    stats[home].played++
    stats[away].played++
    stats[home].gf += hs
    stats[home].ga += as
    stats[away].gf += as
    stats[away].ga += hs

    if (hs > as) {
      stats[home].won++
      stats[home].pts += 3
      stats[away].lost++
    } else if (hs === as) {
      stats[home].drawn++
      stats[home].pts += 1
      stats[away].drawn++
      stats[away].pts += 1
    } else {
      stats[away].won++
      stats[away].pts += 3
      stats[home].lost++
    }

    // Head-to-head tracking
    if (!stats[home].h2h[away]) stats[home].h2h[away] = { pts: 0, gf: 0, ga: 0 }
    if (!stats[away].h2h[home]) stats[away].h2h[home] = { pts: 0, gf: 0, ga: 0 }

    if (hs > as) {
      stats[home].h2h[away].pts += 3
    } else if (hs === as) {
      stats[home].h2h[away].pts += 1
      stats[away].h2h[home].pts += 1
    } else {
      stats[away].h2h[home].pts += 3
    }
    stats[home].h2h[away].gf += hs
    stats[home].h2h[away].ga += as
    stats[away].h2h[home].gf += as
    stats[away].h2h[home].ga += hs
  })

  // Compute goal difference
  Object.values(stats).forEach((s) => {
    s.gd = s.gf - s.ga
  })

  const rows = Object.values(stats)

  // Sort with FIFA 2026 tiebreaker criteria
  rows.sort((a, b) => {
    // 1. Points
    if (b.pts !== a.pts) return b.pts - a.pts

    // 2. Goal difference (all group matches)
    if (b.gd !== a.gd) return b.gd - a.gd

    // 3. Goals scored (all group matches)
    if (b.gf !== a.gf) return b.gf - a.gf

    // Tied teams: apply h2h criteria
    const aVsB = a.h2h[b.team.name] || { pts: 0, gf: 0, ga: 0 }
    const bVsA = b.h2h[a.team.name] || { pts: 0, gf: 0, ga: 0 }

    // 4. H2H points
    if (bVsA.pts !== aVsB.pts) return bVsA.pts - aVsB.pts

    // 5. H2H goal difference
    const aH2Hgd = aVsB.gf - aVsB.ga
    const bH2Hgd = bVsA.gf - bVsA.ga
    if (bH2Hgd !== aH2Hgd) return bH2Hgd - aH2Hgd

    // 6. H2H goals scored
    if (bVsA.gf !== aVsB.gf) return bVsA.gf - aVsB.gf

    // 7. Fair-play score (less negative = better)
    if (b.fairPlay !== a.fairPlay) return a.fairPlay - b.fairPlay

    // 8. Requires drawing of lots — flag it
    return 0
  })

  // Mark ties that require drawing of lots
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]
    const b = rows[i + 1]
    if (
      a.pts === b.pts &&
      a.gd === b.gd &&
      a.gf === b.gf &&
      a.fairPlay === b.fairPlay
    ) {
      a.requiresDrawingOfLots = true
      b.requiresDrawingOfLots = true
    }
  }

  return rows
}

export function computeAllGroupStandings(GROUPS_DATA, matches, results) {
  const standings = {}
  Object.entries(GROUPS_DATA).forEach(([gid, group]) => {
    const groupMatches = matches.filter((m) => m.phase === 'group' && m.group === gid)
    standings[gid] = computeGroupStandings(group.teams, groupMatches, results)
  })
  return standings
}
