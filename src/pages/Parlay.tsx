import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import PageHeader from '../components/PageHeader'
import type { Team } from '../data/seed'
import type { GamePrediction } from '../types'

type BetType = 'moneyline' | 'over' | 'under'

interface ParlayPick {
  gameLabel: string
  homeTeam: Team
  awayTeam: Team
  betType: BetType
  betLabel: string
  prob: number
  fairOdds: number
  date: string
}

interface GameWithPred { label: string; homeTeam: Team; awayTeam: Team; pred: GamePrediction; date: string }

const fairOdds = (prob: number): number => (prob > 0 ? 1 / prob : 999)

/** Cuota decimal justa → americana. */
function american(dec: number): string {
  if (dec <= 1) return '—'
  return dec >= 2 ? '+' + Math.round((dec - 1) * 100) : '-' + Math.round(100 / (dec - 1))
}

const typeLabels: Record<BetType, string> = {
  moneyline: 'Ganador', over: 'Total', under: 'Total',
}

// Solo dos mercados de béisbol: GANADOR (moneyline) y TOTAL (over/under).
// Los tramos se distinguen por número de selecciones (más piernas = más riesgo):
//   Segura 3 · Moderada 4-5 · Riesgosa 5-9.
function generateParlays(games: GameWithPred[]): { safe: ParlayPick[]; moderate: ParlayPick[]; risky: ParlayPick[] } {
  const pool: ParlayPick[] = []
  for (const g of games) {
    const base = { gameLabel: g.label, homeTeam: g.homeTeam, awayTeam: g.awayTeam, date: g.date }
    const p = g.pred
    // Ganador: el favorito del modelo.
    if (p.probHome >= p.probAway) pool.push({ ...base, betType: 'moneyline', betLabel: `Gana ${g.homeTeam.id}`, prob: p.probHome, fairOdds: fairOdds(p.probHome) })
    else pool.push({ ...base, betType: 'moneyline', betLabel: `Gana ${g.awayTeam.id}`, prob: p.probAway, fairOdds: fairOdds(p.probAway) })
    // Total: el lado más probable (over o under).
    if (p.probOver >= p.probUnder) pool.push({ ...base, betType: 'over', betLabel: `Over ${p.runLine} carreras`, prob: p.probOver, fairOdds: fairOdds(p.probOver) })
    else pool.push({ ...base, betType: 'under', betLabel: `Under ${p.runLine} carreras`, prob: p.probUnder, fairOdds: fairOdds(p.probUnder) })
  }
  pool.sort((a, b) => b.prob - a.prob) // de mayor a menor probabilidad

  // Toma las `target` selecciones más probables: primero una por juego (su mejor
  // mercado); si aún faltan, completa con el segundo mercado de juegos ya usados.
  const selectLegs = (target: number): ParlayPick[] => {
    const out: ParlayPick[] = []
    const used = new Set<string>()
    for (const p of pool) { if (out.length >= target) break; if (!used.has(p.gameLabel)) { out.push(p); used.add(p.gameLabel) } }
    for (const p of pool) { if (out.length >= target) break; if (!out.includes(p)) out.push(p) }
    return out
  }

  return {
    safe: selectLegs(3),      // 3 selecciones (las más seguras)
    moderate: selectLegs(5),  // 4-5 selecciones
    risky: selectLegs(9),     // 5-9 selecciones
  }
}

function ParlayColumn({ tier, accent, picks }: { tier: string; accent: string; picks: ParlayPick[] }) {
  if (picks.length === 0) return null
  const combinedProb = picks.reduce((acc, p) => acc * p.prob, 1)
  const combinedOdds = american(fairOdds(combinedProb))
  return (
    <div style={{ background: 'linear-gradient(180deg,var(--surface-2),var(--surface))', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ padding: '15px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${accent}` }}>
        <div>
          <div style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 16, color: accent }}>{tier}</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{picks.length} selecciones</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'var(--fm)', fontWeight: 700, fontSize: 20 }}>{combinedOdds}</div>
          <div style={{ fontFamily: 'var(--fm)', fontSize: 11, color: 'var(--muted)' }}>prob {(combinedProb * 100).toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ padding: '6px 8px' }}>
        {picks.map((lg, i) => (
          <div key={i}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 10px', borderRadius: 9 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--fd)', fontWeight: 600, fontSize: 13.5 }}>{lg.betLabel}</div>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--faint)', marginTop: 2 }}>{lg.awayTeam.id} @ {lg.homeTeam.id} · {typeLabels[lg.betType]}</div>
              </div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 13, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>{american(lg.fairOdds)}</span>
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

  const { todayGames, dateLabel } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const upcomingDates = [...new Set(games.filter((g) => !g.played).map((g) => g.date))].sort()
    const targetDate = upcomingDates.find((d) => d >= today) ?? upcomingDates[0]
    const result: GameWithPred[] = []
    if (targetDate) {
      for (const g of games.filter((x) => x.date === targetDate && !x.played)) {
        const home = teams[g.homeId], away = teams[g.awayId]
        const pred = predictions[g.id]
        if (!home || !away || !pred) continue
        result.push({ label: g.id, homeTeam: home, awayTeam: away, pred, date: g.date })
      }
    }
    const d = targetDate ? new Date(targetDate + 'T12:00:00') : new Date()
    return { todayGames: result, dateLabel: d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }
  }, [teams, games, predictions])

  const parlays = useMemo(() => generateParlays(todayGames), [todayGames])

  if (todayGames.length === 0) {
    return (
      <section style={{ animation: 'fadein .3s ease' }}>
        <PageHeader eyebrow="Parlay · Combinadas" title="Combinadas del día" />
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--fd)', fontWeight: 700, fontSize: 18 }}>Sin juegos próximos</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>No hay juegos programados próximamente.</p>
        </div>
      </section>
    )
  }

  return (
    <section style={{ animation: 'fadein .3s ease' }}>
      <PageHeader
        eyebrow="Parlay · Combinadas"
        title="Combinadas del día"
        subtitle={`${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} · ${todayGames.length} juego${todayGames.length > 1 ? 's' : ''} · solo ganador y total (over/under)`}
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
