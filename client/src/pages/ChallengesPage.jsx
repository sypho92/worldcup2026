import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { AvatarDisplay } from '../components/AvatarDisplay'
import Flag from '../components/Flag'
import { abbrev } from '../utils/format'

export default function ChallengesPage() {
  const { player, players, challenges, allBets, results, respondToChallenge } = useApp()

  // Enrich each challenge with computed win/loss state
  const enriched = useMemo(() => {
    if (!player) return []
    return Object.entries(challenges)
      .filter(([, c]) =>
        c.challengerId === player.pseudoId || c.challengedId === player.pseudoId
      )
      .map(([id, c]) => {
        const result = results[c.matchId]
        const myBet  = allBets[player.pseudoId]?.[c.matchId]
        const finished = !!result
        const iWon  = finished && !!myBet && myBet === result?.winner
        const iLost = finished && !!myBet && myBet !== result?.winner
        return { id, ...c, finished, iWon, iLost }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [challenges, player, results, allBets])

  if (!player) return null

  // Section buckets
  const toRespond = enriched.filter(c => c.challengedId === player.pseudoId && c.status === 'pending')
  const enCours   = enriched.filter(c => c.status === 'accepted' && !c.finished)
  const aHonorer  = enriched.filter(c => c.status === 'accepted' && c.finished && c.iLost)
  const remportes = enriched.filter(c => c.status === 'accepted' && c.finished && c.iWon)
  const enAttente = enriched.filter(c => c.challengerId === player.pseudoId && c.status === 'pending')

  const sharedProps = { players, allBets, results, player, onRespond: respondToChallenge }

  return (
    <div className="page">
      <h1 className="page-title">⚔ Défis</h1>

      {/* 1 — À répondre */}
      <Section
        title="À répondre"
        badge={toRespond.length}
        badgeVariant="accent"
        emptyIcon="⚔"
        emptyText="Aucun défi reçu en attente"
        items={toRespond}
      >
        {toRespond.map(c => (
          <ChallengeCard key={c.id} challenge={c} mode="respond" {...sharedProps} />
        ))}
      </Section>

      {/* 2 — En cours */}
      <Section
        title="En cours"
        badge={enCours.length}
        badgeVariant="gold"
        emptyIcon="🎯"
        emptyText="Aucun défi actif pour l'instant"
        items={enCours}
      >
        {enCours.map(c => (
          <ChallengeCard key={c.id} challenge={c} mode="active" {...sharedProps} />
        ))}
      </Section>

      {/* 3 — À honorer (lost) */}
      <Section
        title="À honorer"
        badge={aHonorer.length}
        badgeVariant="error"
        emptyIcon="✓"
        emptyText="Rien à honorer — bien joué !"
        items={aHonorer}
      >
        {aHonorer.map(c => (
          <ChallengeCard key={c.id} challenge={c} mode="lost" {...sharedProps} />
        ))}
      </Section>

      {/* 4 — Victoires */}
      <Section
        title="Victoires"
        badge={remportes.length}
        badgeVariant="success"
        emptyIcon="🏆"
        emptyText="Aucune victoire encore"
        items={remportes}
      >
        {remportes.map(c => (
          <ChallengeCard key={c.id} challenge={c} mode="won" {...sharedProps} />
        ))}
      </Section>

      {/* 5 — Envoyés en attente */}
      <Section
        title="Envoyés"
        badge={enAttente.length}
        badgeVariant="muted"
        emptyIcon="📤"
        emptyText="Tu n'as encore défié personne"
        items={enAttente}
      >
        {enAttente.map(c => (
          <ChallengeCard key={c.id} challenge={c} mode="sent" {...sharedProps} />
        ))}
      </Section>
    </div>
  )
}

/* ── Section wrapper ──────────────────────────────────────────────────────── */
function Section({ title, badge, badgeVariant, emptyIcon, emptyText, items, children }) {
  // Always show sections that have items; hide empty ones except "À honorer" (show its positive empty)
  if (items.length === 0 && title !== 'À honorer') return null

  return (
    <section className="challenges-section">
      <h2 className="challenges-section-title">
        {title}
        {badge > 0 && (
          <span className={`challenges-count challenges-count--${badgeVariant}`}>{badge}</span>
        )}
      </h2>
      {items.length === 0 ? (
        <div className="empty-state">
          <div className="icon">{emptyIcon}</div>
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="challenges-list">{children}</div>
      )}
    </section>
  )
}

/* ── Challenge card ───────────────────────────────────────────────────────── */
function ChallengeCard({ challenge, mode, players, allBets, results, player, onRespond }) {
  const { matchesById } = useApp()
  const otherId = challenge.challengerId === player.pseudoId
    ? challenge.challengedId
    : challenge.challengerId
  const other = players[otherId]
  const match = matchesById[challenge.matchId]
  if (!other || !match) return null

  const myBet    = allBets[player.pseudoId]?.[challenge.matchId]
  const theirBet = allBets[otherId]?.[challenge.matchId]
  const result   = results[challenge.matchId]

  const getBetTeam = (bet) =>
    bet === 'home' ? match.homeTeam
    : bet === 'away' ? match.awayTeam
    : null

  const myBetTeam    = getBetTeam(myBet)
  const theirBetTeam = getBetTeam(theirBet)

  const typeLabel = challenge.type === 'double' ? '🎯 Quitte ou double' : '📝 Gage'

  // Card border variant based on mode
  const cardVariant =
    mode === 'lost'   ? 'error'
    : mode === 'won'  ? 'success'
    : mode === 'active' ? 'gold'
    : 'default'

  return (
    <div className={`challenge-card challenge-card--${cardVariant}`}>

      {/* ── Header: other player + match + type ── */}
      <div className="challenge-card-header">
        <AvatarDisplay avatar={other.avatar} size={40} />
        <div className="challenge-card-info">
          <span className="challenge-card-name">{other.name}</span>
          <span className="challenge-card-match">
            <Flag flag={match.homeTeam.flag} size={12} />
            <span>{abbrev(match.homeTeam)}</span>
            <span className="challenge-card-sep">–</span>
            <span>{abbrev(match.awayTeam)}</span>
            <Flag flag={match.awayTeam.flag} size={12} />
          </span>
        </div>
        <span className="challenge-card-type-badge">{typeLabel}</span>
      </div>

      {/* ── Gage text ── */}
      {challenge.gage && mode !== 'lost' && mode !== 'won' && (
        <div className="challenge-card-gage">"{challenge.gage}"</div>
      )}

      {/* ── Bets row (respond / active / sent) ── */}
      {(mode === 'respond' || mode === 'active' || mode === 'sent') && (
        <div className="challenge-card-bets">
          <div className="challenge-card-bet">
            <span className="challenge-card-bet-label">Toi</span>
            <span className="challenge-card-bet-val">
              {myBetTeam
                ? <><Flag flag={myBetTeam.flag} size={13} /> {abbrev(myBetTeam)}</>
                : myBet === 'draw' ? 'Nul'
                : <span className="challenge-card-no-bet">—</span>}
            </span>
          </div>
          <span className="challenge-card-sword">⚔</span>
          <div className="challenge-card-bet challenge-card-bet--other">
            <span className="challenge-card-bet-label">{other.name}</span>
            <span className="challenge-card-bet-val">
              {theirBetTeam
                ? <><Flag flag={theirBetTeam.flag} size={13} /> {abbrev(theirBetTeam)}</>
                : theirBet === 'draw' ? 'Nul'
                : <span className="challenge-card-no-bet">—</span>}
            </span>
          </div>
        </div>
      )}

      {/* ── Mode: respond ── */}
      {mode === 'respond' && (
        <div className="challenge-card-actions">
          <button className="challenge-card-reject" onClick={() => onRespond(challenge.id, 'rejected')}>
            ✗ Refuser
          </button>
          <button className="challenge-card-accept" onClick={() => onRespond(challenge.id, 'accepted')}>
            ✓ Accepter
          </button>
        </div>
      )}

      {/* ── Mode: active (match not played yet) ── */}
      {mode === 'active' && (
        <div className="challenge-card-active-footer">
          <span className="challenge-card-active-dot" />
          <span>Match le {match.date} à {match.time}</span>
        </div>
      )}

      {/* ── Mode: lost (I lost) ── */}
      {mode === 'lost' && (
        <div className="challenge-card-outcome challenge-card-outcome--lost">
          {challenge.type === 'gage' ? (
            <>
              <div className="challenge-outcome-headline">⚠ Gage à honorer</div>
              <div className="challenge-outcome-gage">"{challenge.gage || 'Gage convenu'}"</div>
              <div className="challenge-outcome-sub">envers {other.name}</div>
            </>
          ) : (
            <>
              <div className="challenge-outcome-headline">🎯 Quitte ou double perdu</div>
              <div className="challenge-outcome-sub">–1 pt · face à {other.name}</div>
            </>
          )}
          {result && (
            <div className="challenge-outcome-score">
              {abbrev(match.homeTeam)} {result.homeScore} – {result.awayScore} {abbrev(match.awayTeam)}
            </div>
          )}
        </div>
      )}

      {/* ── Mode: won (I won) ── */}
      {mode === 'won' && (
        <div className="challenge-card-outcome challenge-card-outcome--won">
          {challenge.type === 'gage' ? (
            <>
              <div className="challenge-outcome-headline">🏆 Victoire !</div>
              <div className="challenge-outcome-gage-label">{other.name} te doit :</div>
              <div className="challenge-outcome-gage">"{challenge.gage || 'Le gage convenu'}"</div>
            </>
          ) : (
            <>
              <div className="challenge-outcome-headline">🏆 Quitte ou double remporté !</div>
              <div className="challenge-outcome-sub">+1 pt · contre {other.name}</div>
            </>
          )}
          {result && (
            <div className="challenge-outcome-score">
              {abbrev(match.homeTeam)} {result.homeScore} – {result.awayScore} {abbrev(match.awayTeam)}
            </div>
          )}
        </div>
      )}

      {/* ── Mode: sent (waiting for response) ── */}
      {mode === 'sent' && (
        <div className="challenge-card-status challenge-card-status--pending">
          ⏳ En attente de réponse de {other.name}
        </div>
      )}
    </div>
  )
}
