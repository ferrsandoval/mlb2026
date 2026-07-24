import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import PageHeader from '../components/PageHeader'
import type { Team } from '../data/seed'
import type { GamePrediction } from '../types'

type BetType = 'moneyline' | 'over' | 'under'
type Result = 'hit' | 'miss' | null

interface ParlayPick {
  gameLabel: string
  homeTeam: Team
  awayTeam: Team
  betType: BetType
  betLabel: string
  prob: number
  fairOdds: number
  result: Result // acierto/fallo del juego, o null si aún no se juega
}

interface GameWithPred {
  label: string; homeTeam: Team; awayTeam: Team; pred: GamePrediction
  played: boolean; homeRuns: number; awayRuns: number
}

const fairOdds = (prob: number): number => (prob > 0 ? 1 / prob : 999)

/** Cuota decimal justa → americana. */
function american(dec: number): string {
  if (dec <= 1) return '—'
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) : '-' + Math.round(100 / (dec - 1))
}

const typeLabels: Record<BetType, string> = {
  moneyline: 'Ganador', over: 'Total', under: 'Total',
}

const chipBtn: React.CSSProperties = {
  padding: '8px 12px', background: 'transparent', border: 0, color: 'var(--muted)',
  fontFamily: 'var(--fu)', fontSize: 13, cursor: 'pointer',
}

// Dos mercados: GANADOR (moneyline) y TOTAL (over/under).
//   Segura   → 3, SOLO moneyline.
//   Moderada → 5, prioriza moneyline (mínimo over/under posible).
//   Riesgosa → hasta 15, prioriza moneyline (mínimo over/under posible).
function generateParlays(games: GameWithPred[]): { safe: ParlayPick[]; moderate: ParlayPick[]; risky: ParlayPick[] } {
  const mlPicks: ParlayPick[] = []
  const ouPicks: ParlayPick[] = []
  for (const g of games) {
    const p = g.pred
    const base = { gameLabel: g.label, homeTeam: g.homeTeam, awayTeam: g.awayTeam }
    const realHomeWon = g.played && g.homeRuns > g.awayRuns
    const realOver = g.played && g.homeRuns + g.awayRuns > p.runLine

    const pickHome = p.probHome >= p.probAway
    mlPicks.push({
      ...base, betType: 'moneyline',
      betLabel: `Gana ${pickHome ? g.homeTeam.id : g.awayTeam.id}`,
      prob: pickHome ? p.probHome : p.probAway, fairOdds: fairOdds(pickHome ? p.probHome : p.probAway),
      result: g.played ? (pickHome === realHomeWon ? 'hit' : 'miss') : null,
    })

    const over = p.probOver >= p.probUnder
    ouPicks.push({
      ...base, betType: over ? 'over' : 'under',
      betLabel: `${over ? 'Over' : 'Under'} ${p.runLine} carreras`,
      prob: over ? p.probOver : p.probUnder, fairOdds: fairOdds(over ? p.probOver : p.probUnder),
      result: g.played ? (over === realOver ? 'hit' : 'miss') : null,
    })
  }
  mlPicks.sort((a, b) => b.prob - a.prob)
  ouPicks.sort((a, b) => b.prob - a.prob)

  const preferML = (target: number): ParlayPick[] => {
    const out: ParlayPick[] = []
    const used = new Set<string>()
    for (const p of mlPicks) { if (out.length >= target) break; if (!used.has(p.gameLabel)) { out.push(p); used.add(p.gameLabel) } }
    for (const p of ouPicks) { if (out.length >= target) break; out.push(p) }
    return out
  }

  return { safe: mlPicks.slice(0, 3), moderate: preferML(5), risky: preferML(15) }
}

function ResultPill({ result }: { result: Result }) {
  if (result === null) return null
  const hit = result === 'hit'
  return (
    <span style={{ fontFamily: 'var(--fm)', fontSize: 10, fontWeight: 700, color: hit ? 'var(--green)' : 'var(--red-b)', background: hit ? 'rgba(52,199,123,.13)' : 'rgba(232,66,89,.13)', border: `1px solid ${hit ? 'rgba(52,199,123,.35)' : 'rgba(232,66,89,.35)'}`, padding: '1px 7px', borderRadius: 20 }}>
      {hit ? '✓ Acierto' : '✗ Fallo'}
    </span>
  )
}

function ParlayColumn({ tier, accent, picks }: { tier: string; accent: string; picks: ParlayPick[] }) {
  if (picks.length === 0) return null
  const combinedProb = picks.reduce((acc, p) => acc * p.prob, 1)
  const combinedOdds = american(fairOdds(combinedProb))

  // Estado del parlay: aciertos vs jugados; ganado solo si TODAS las piernas aciertan.
  const settled = picks.filter((p) => p.result !== null)
  const hits = picks.filter((p) => p.result === 'hit').length
  const allPlayed = settled.length === picks.length
  const parlayWon = allPlayed && hits === picks.length
  const anyMiss = picks.some((p) => p.result === 'miss')

  return (
    <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${accent}` }}>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 16, color: accent }}>{tier}</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
            {picks.length} selecciones
            {settled.length > 0 && <span style={{ color: 'var(--muted)' }}> · {hits}/{settled.length} aciertos</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {allPlayed ? (
            <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, color: parlayWon ? 'var(--green)' : 'var(--red-b)' }}>
              {parlayWon ? '✓ GANADA' : '✗ PERDIDA'}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 20, color: anyMiss ? 'var(--red-b)' : undefined }}>{combinedOdds}</div>
          )}
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>prob {(combinedProb * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ padding: '6px 8px' }}>
        {picks.map((lg, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 10px', borderRadius: 9, opacity: lg.result === 'miss' ? 0.6 : 1 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 13.5 }}>{lg.betLabel}</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{lg.awayTeam.id} @ {lg.homeTeam.id} · {typeLabels[lg.betType]}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{american(lg.fairOdds)}</span>
                <ResultPill result={lg.result} />
              </div>
            </div>
            {i < picks.length - 1 && <div style={{ height: 1, background: 'var(--border)', margin: '0 10px' }} />}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 10px 8px' }}>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)' }}>Cuota justa combinada</span>
          <span style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 15, color: accent }}>{combinedOdds}</span>
        </div>
      </div>
    </div>
  )
}

export default function Parlay() {
  const teams = useStore((s) => s.teams)
  const games = useStore((s) => s.games)
  const predictions = useStore((s) => s.predictions)

  const today = new Date().toISOString().slice(0, 10)
  const allDates = useMemo(() => [...new Set(games.map((g) => g.date))].sort(), [games])
  const [dateIdx, setDateIdx] = useState(() => {
    const i = allDates.findIndex((d) => d >= today)
    return i === -1 ? Math.max(0, allDates.length - 1) : i
  })
  const activeDate = allDates[dateIdx] ?? allDates[0]

  const dayGames = useMemo(() => {
    const out: GameWithPred[] = []
    for (const g of games.filter((x) => x.date === activeDate)) {
      const home = teams[g.homeId], away = teams[g.awayId], pred = predictions[g.id]
      if (!home || !away || !pred) continue
      out.push({
        label: g.id, homeTeam: home, awayTeam: away, pred,
        played: !!(g.played && g.homeRuns != null && g.awayRuns != null),
        homeRuns: g.homeRuns ?? 0, awayRuns: g.awayRuns ?? 0,
      })
    }
    return out
  }, [teams, games, predictions, activeDate])

  const parlays = useMemo(() => generateParlays(dayGames), [dayGames])
  const dateLabel = activeDate
    ? new Date(activeDate + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const dateNav = (
    <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <button style={chipBtn} onClick={() => setDateIdx((i) => Math.max(0, i - 1))}>‹</button>
      <button style={{ ...chipBtn, background: 'var(--surface-2)', borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--fm)', fontSize: 12 }}
        onClick={() => { const i = allDates.findIndex((d) => d >= today); setDateIdx(i === -1 ? Math.max(0, allDates.length - 1) : i) }}>Hoy</button>
      <button style={chipBtn} onClick={() => setDateIdx((i) => Math.min(allDates.length - 1, i + 1))}>›</button>
    </div>
  )

  if (dayGames.length === 0) {
    return (
      <section style={{ animation: 'fadein .3s ease' }}>
        <PageHeader eyebrow="Parlay · Combinadas" title="Combinadas del día" right={dateNav} />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>Sin juegos</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>No hay juegos para la fecha seleccionada.</p>
        </div>
      </section>
    )
  }

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader
        eyebrow="Parlay · Combinadas"
        title="Combinadas del día"
        subtitle={`${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · ${dayGames.length} juego${dayGames.length > 1 ? 's' : ''} · ganador y total; ✓/✗ por juego al finalizar`}
        right={dateNav}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 14, alignItems: 'start' }}>
        <ParlayColumn tier="Segura" accent="var(--green)" picks={parlays.safe} />
        <ParlayColumn tier="Moderada" accent="var(--amber)" picks={parlays.moderate} />
        <ParlayColumn tier="Riesgosa" accent="var(--red-b)" picks={parlays.risky} />
      </div>

      <p style={{ textAlign: 'center', padding: '18px 0 0', fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)' }}>
        Cuotas justas del modelo (sin margen de la casa). Ejercicio estadístico, no asesoría financiera.
      </p>
    </section>
  )
}
