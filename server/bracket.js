'use strict'
const { db } = require('./firebase')

// ─── Propagation du bracket éliminatoires ────────────────────────────────────
// Vainqueur de chaque match → prochain match (side home|away)
// SF : le perdant va en match pour la 3e place
// Structure officielle FIFA 2026 (bracket symétrique gauche/droite).
// Les m-id sont assignés par DATE, pas par numéro de match officiel : on
// route donc explicitement chaque match vers son suivant pour reproduire
// l'arbre officiel (cf. image bracket FIFA).
//
//   MOITIÉ GAUCHE → demie m101                MOITIÉ DROITE → demie m102
//   m090 = m075(All/Par)  + m078(Fra/Sue)     m091 = m074(Bré/Jap) + m077(CIv/Nor)
//   m089 = m073(AfS/Can)  + m076(PB/Mar)      m092 = m079(Mex/Equ) + m080(Ang/Cgo)
//   m093 = m084(Por/Cro)  + m083(Esp/Aut)     m095 = m087(Arg/CpV) + m086(Aus/Egy)
//   m094 = m082(USA/Bos)  + m081(Bel/Sén)     m096 = m085(Sui/Alg) + m088(Col/Gha)
const BRACKET = {
  // ── Seizièmes → Huitièmes — MOITIÉ GAUCHE ──
  m075: { next: 'm090', side: 'home' },  // Allemagne/Paraguay
  m078: { next: 'm090', side: 'away' },  // France/Suède
  m073: { next: 'm089', side: 'home' },  // Afrique du Sud/Canada
  m076: { next: 'm089', side: 'away' },  // Pays-Bas/Maroc
  m084: { next: 'm093', side: 'home' },  // Portugal/Croatie
  m083: { next: 'm093', side: 'away' },  // Espagne/Autriche
  m082: { next: 'm094', side: 'home' },  // USA/Bosnie
  m081: { next: 'm094', side: 'away' },  // Belgique/Sénégal
  // ── Seizièmes → Huitièmes — MOITIÉ DROITE ──
  m074: { next: 'm091', side: 'home' },  // Brésil/Japon
  m077: { next: 'm091', side: 'away' },  // Côte d'Ivoire/Norvège
  m079: { next: 'm092', side: 'home' },  // Mexique/Équateur
  m080: { next: 'm092', side: 'away' },  // Angleterre/Congo
  m087: { next: 'm095', side: 'home' },  // Argentine/Cap-Vert
  m086: { next: 'm095', side: 'away' },  // Australie/Égypte
  m085: { next: 'm096', side: 'home' },  // Suisse/Algérie
  m088: { next: 'm096', side: 'away' },  // Colombie/Ghana
  // ── Huitièmes → Quarts ──
  m089: { next: 'm097', side: 'home' },  // GAUCHE haut
  m090: { next: 'm097', side: 'away' },
  m093: { next: 'm099', side: 'home' },  // GAUCHE bas
  m094: { next: 'm099', side: 'away' },
  m091: { next: 'm098', side: 'home' },  // DROITE haut
  m092: { next: 'm098', side: 'away' },
  m095: { next: 'm100', side: 'home' },  // DROITE bas
  m096: { next: 'm100', side: 'away' },
  // ── Quarts → Demies ──
  m097: { next: 'm101', side: 'home' },  // m101 = demie GAUCHE
  m099: { next: 'm101', side: 'away' },
  m098: { next: 'm102', side: 'home' },  // m102 = demie DROITE
  m100: { next: 'm102', side: 'away' },
  // ── Demies → Finale + 3e place ──
  m101: { next: 'm104', side: 'home', loserNext: 'm103', loserSide: 'home' },
  m102: { next: 'm104', side: 'away', loserNext: 'm103', loserSide: 'away' },
}

// Propage le vainqueur (et le perdant pour les SF) dans Firebase
async function propagateBracket(matchId, matchData, winner) {
  const entry = BRACKET[matchId]
  if (!entry) return

  const winnerTeam = winner === 'home' ? matchData.homeTeam : matchData.awayTeam
  const loserTeam  = winner === 'home' ? matchData.awayTeam : matchData.homeTeam

  if (winnerTeam?.name) {
    await db.ref(`matches/${entry.next}/${entry.side}Team`).set(winnerTeam)
    console.log(`[bracket] ${matchId} → ${entry.next} (${entry.side}): ${winnerTeam.name}`)
  }

  if (entry.loserNext && loserTeam?.name) {
    await db.ref(`matches/${entry.loserNext}/${entry.loserSide}Team`).set(loserTeam)
    console.log(`[bracket] loser ${matchId} → ${entry.loserNext} (${entry.loserSide}): ${loserTeam.name}`)
  }
}

// Classement simplifié d'un groupe à partir des résultats Firebase
function computeGroupStandings(matches, group) {
  const groupMatches = Object.values(matches).filter(m => m.phase === 'group' && m.group === group)

  const teamsMap = {}
  groupMatches.forEach(m => {
    const init = (t) => { if (t?.name && !teamsMap[t.name]) teamsMap[t.name] = { ...t, pts: 0, gd: 0, gf: 0, ga: 0, played: 0 } }
    init(m.homeTeam); init(m.awayTeam)
  })

  groupMatches.forEach(m => {
    if (!m.result) return
    const hn = m.homeTeam?.name, an = m.awayTeam?.name
    if (!hn || !an || !teamsMap[hn] || !teamsMap[an]) return

    const hs = m.result.homeScore, as_ = m.result.awayScore
    teamsMap[hn].played++; teamsMap[an].played++
    teamsMap[hn].gf += hs; teamsMap[hn].ga += as_
    teamsMap[an].gf += as_; teamsMap[an].ga += hs
    teamsMap[hn].gd = teamsMap[hn].gf - teamsMap[hn].ga
    teamsMap[an].gd = teamsMap[an].gf - teamsMap[an].ga

    if (hs > as_) { teamsMap[hn].pts += 3; teamsMap[an].pts += 0 }
    else if (as_ > hs) { teamsMap[an].pts += 3; teamsMap[hn].pts += 0 }
    else { teamsMap[hn].pts++; teamsMap[an].pts++ }
  })

  return Object.values(teamsMap).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}

// Résout les placeholders "1er Groupe X" / "2e Groupe X" quand le groupe est terminé
async function resolveGroupSlots() {
  const snap = await db.ref('matches').get()
  if (!snap.exists()) return
  const matches = snap.val()

  let updated = 0

  for (const [matchId, match] of Object.entries(matches)) {
    if (match.phase === 'group' || match.result) continue

    for (const side of ['homeTeam', 'awayTeam']) {
      const team = match[side]
      if (!team?.name) continue

      const m1 = team.name.match(/^1er Groupe ([A-L])$/)
      const m2 = team.name.match(/^2e Groupe ([A-L])$/)
      if (!m1 && !m2) continue

      const group = (m1 || m2)[1]
      const position = m1 ? 0 : 1

      // Attend que les 6 matchs du groupe soient joués
      const groupMatches = Object.values(matches).filter(m => m.phase === 'group' && m.group === group)
      if (!groupMatches.every(m => m.result)) continue

      const standings = computeGroupStandings(matches, group)
      const realTeam = standings[position]
      if (!realTeam?.name || realTeam.name === team.name) continue

      const teamObj = { name: realTeam.name, flag: realTeam.flag || null, tla: realTeam.tla || null }
      await db.ref(`matches/${matchId}/${side}`).set(teamObj)
      console.log(`[bracket] ${matchId} ${side}: "${team.name}" → ${realTeam.name}`)
      updated++
    }
  }

  if (updated > 0) console.log(`[bracket] ${updated} slot(s) groupe résolu(s)`)
}

// Backfill au démarrage : rejoue la propagation pour les matchs terminés
// dont le suivant n'a pas encore reçu l'équipe correcte
async function backfillBracket() {
  const snap = await db.ref('matches').get()
  if (!snap.exists()) return
  const matches = snap.val()

  let count = 0
  for (const [matchId, match] of Object.entries(matches)) {
    if (!BRACKET[matchId] || !match.result?.winner) continue

    const entry = BRACKET[matchId]
    const nextMatch = matches[entry.next]
    if (!nextMatch) continue

    const currentTeam = nextMatch[`${entry.side}Team`]
    const winnerTeam = match.result.winner === 'home' ? match.homeTeam : match.awayTeam
    if (!winnerTeam?.name || currentTeam?.name === winnerTeam.name) continue

    await propagateBracket(matchId, match, match.result.winner)
    count++
  }

  if (count > 0) console.log(`[bracket] backfill: ${count} match(s) re-propagé(s)`)
}

module.exports = { propagateBracket, resolveGroupSlots, backfillBracket }
