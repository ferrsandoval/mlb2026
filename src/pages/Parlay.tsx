import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import type { Team } from '../data/seed'
import type { GamePrediction } from '../types'

type BetType = 'moneyline' | 'over' | 'under' | 'run_line_home' | 'run_line_away' | 'exact'

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

interface GameWithPred {
  label: string
  homeTeam: Team
  awayTeam: Team
  pred: GamePrediction
  date: string
}

function fairOdds(prob: number): number {
  return prob > 0 ? 1 / prob : 999
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + '%'
}

function generateParlays(games: GameWithPred[]): { safe: ParlayPick[]; moderate: ParlayPick[]; risky: ParlayPick[] } {
  const allPicks: ParlayPick[] = []

  for (const g of games) {
    const base = { gameLabel: g.label, homeTeam: g.homeTeam, awayTeam: g.awayTeam, date: g.date }
    const p = g.pred

    if (p.probHome > p.probAway) {
      allPicks.push({ ...base, betType: 'moneyline', betLabel: `Gana ${g.homeTeam.id}`, prob: p.probHome, fairOdds: fairOdds(p.probHome) })
    } else {
      allPicks.push({ ...base, betType: 'moneyline', betLabel: `Gana ${g.awayTeam.id}`, prob: p.probAway, fairOdds: fairOdds(p.probAway) })
    }

    allPicks.push({ ...base, betType: 'over',  betLabel: `Over ${p.runLine} carreras`,  prob: p.probOver,  fairOdds: fairOdds(p.probOver) })
    allPicks.push({ ...base, betType: 'under', betLabel: `Under ${p.runLine} carreras`, prob: p.probUnder, fairOdds: fairOdds(p.probUnder) })

    allPicks.push({ ...base, betType: 'run_line_home', betLabel: `${g.homeTeam.id} -1.5`, prob: p.probHomeMinus15, fairOdds: fairOdds(p.probHomeMinus15) })
    allPicks.push({ ...base, betType: 'run_line_away', betLabel: `${g.awayTeam.id} +1.5`, prob: p.probAwayPlus15, fairOdds: fairOdds(p.probAwayPlus15) })

    const top = p.topScorelines[0]
    allPicks.push({ ...base, betType: 'exact', betLabel: `Exacto ${top.home}–${top.away}`, prob: top.prob, fairOdds: fairOdds(top.prob) })
  }

  const safe: ParlayPick[] = []
  for (const g of games) {
    const candidates = allPicks.filter((p) => p.gameLabel === g.label && p.betType === 'moneyline' && p.prob > 0.58)
    candidates.sort((a, b) => b.prob - a.prob)
    if (candidates[0]) safe.push(candidates[0])
  }

  const moderate: ParlayPick[] = []
  const used = new Set<string>()
  const winners = allPicks.filter((p) => p.betType === 'moneyline').sort((a, b) => b.prob - a.prob)
  if (winners[0]) { moderate.push(winners[0]); used.add(winners[0].gameLabel) }
  const ouPicks = allPicks.filter((p) => (p.betType === 'over' || p.betType === 'under') && !used.has(p.gameLabel)).sort((a, b) => b.prob - a.prob)
  if (ouPicks[0]) { moderate.push(ouPicks[0]); used.add(ouPicks[0].gameLabel) }
  const rlPicks = allPicks.filter((p) => (p.betType === 'run_line_home' || p.betType === 'run_line_away') && !used.has(p.gameLabel)).sort((a, b) => b.prob - a.prob)
  if (rlPicks[0]) moderate.push(rlPicks[0])

  const risky: ParlayPick[] = []
  const riskyMl = allPicks.filter((p) => p.betType === 'moneyline').sort((a, b) => b.prob - a.prob)
  if (riskyMl[0]) risky.push(riskyMl[0])
  if (riskyMl[1]) risky.push(riskyMl[1])
  const exactPicks = allPicks.filter((p) => p.betType === 'exact').sort((a, b) => b.prob - a.prob)
  if (exactPicks[0]) risky.push(exactPicks[0])

  return { safe, moderate, risky }
}

function PickRow({ pick, index }: { pick: ParlayPick; index: number }) {
  const typeColors: Record<BetType, string> = {
    moneyline: 'var(--color-primary)',
    over: 'var(--color-positive)',
    under: '#E8A317',
    run_line_home: '#6366f1',
    run_line_away: '#8b5cf6',
    exact: 'var(--color-accent)',
  }
  const typeLabels: Record<BetType, string> = {
    moneyline: 'Moneyline', over: 'Total', under: 'Total', run_line_home: 'Run Line', run_line_away: 'Run Line', exact: 'Marcador',
  }

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="flex items-start gap-3">
        <div className="font-black text-xl w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0" style={{ backgroundColor: typeColors[pick.betType], color: 'white' }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TeamBadge team={pick.homeTeam} size="sm" />
            <span className="text-xs font-bold" style={{ color: 'var(--color-gray-light)', opacity: 0.7 }}>{pick.awayTeam.id} @ {pick.homeTeam.id}</span>
            <TeamBadge team={pick.awayTeam} size="sm" />
          </div>
          <p className="font-black text-lg uppercase" style={{ color: 'var(--color-gray-light)' }}>{pick.betLabel}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColors[pick.betType], color: 'white', opacity: 0.9 }}>{typeLabels[pick.betType]}</span>
            <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>{pick.date}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-black text-2xl" style={{ color: pick.prob >= 0.55 ? 'var(--color-positive)' : pick.prob >= 0.40 ? 'var(--color-gray-light)' : 'var(--color-accent)' }}>{pct(pick.prob)}</p>
          <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Cuota justa {pick.fairOdds.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}

function ParlayCard({ title, subtitle, picks, color }: { title: string; subtitle: string; picks: ParlayPick[]; color: string }) {
  if (picks.length === 0) return null
  const combinedProb = picks.reduce((acc, p) => acc * p.prob, 1)
  const combinedOdds = fairOdds(combinedProb)

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}33` }}>
      <div className="px-5 py-3 flex items-center justify-between" style={{ backgroundColor: `${color}18` }}>
        <div>
          <h3 className="font-black text-xl uppercase" style={{ color }}>{title}</h3>
          <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="font-black text-3xl" style={{ color }}>{combinedOdds.toFixed(2)}x</p>
          <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Prob. {pct(combinedProb)}</p>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {picks.map((pick, i) => <PickRow key={i} pick={pick} index={i} />)}
      </div>
      <div className="px-5 py-3 flex items-center justify-between text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'var(--color-gray-light)', opacity: 0.5 }}>
        <span>{picks.length} selecciones</span>
        <span>Apuesta $100 → Pago potencial ${(100 * combinedOdds).toFixed(0)}</span>
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
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <p className="font-black text-2xl uppercase mb-2" style={{ color: 'var(--color-gray-light)' }}>Sin juegos próximos</p>
        <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>No hay juegos programados próximamente.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-black text-3xl uppercase" style={{ color: 'var(--color-gray-light)' }}>Parlay del Día</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
          {dateLabel} · {todayGames.length} juego{todayGames.length > 1 ? 's' : ''} · Generado con modelo Elo+Poisson
        </p>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h3 className="font-bold text-sm uppercase mb-3" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Juegos del día</h3>
        <div className="space-y-2">
          {todayGames.map((g, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-bg-base)' }}>
              <div className="flex items-center gap-2">
                <TeamBadge team={g.awayTeam} size="sm" />
                <span className="text-sm font-bold" style={{ color: 'var(--color-gray-light)' }}>{g.awayTeam.id} @ {g.homeTeam.id}</span>
                <TeamBadge team={g.homeTeam} size="sm" />
              </div>
              <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>{pct(g.pred.probAway)} – {pct(g.pred.probHome)}</span>
            </div>
          ))}
        </div>
      </div>

      <ParlayCard title="Parlay Seguro" subtitle="Favoritos claros de moneyline — baja cuota, alta probabilidad" picks={parlays.safe} color="#22c55e" />
      <ParlayCard title="Parlay Moderado" subtitle="Mix de ganador + total + línea de carreras — equilibrio riesgo/pago" picks={parlays.moderate} color="#3b82f6" />
      <ParlayCard title="Parlay Riesgoso" subtitle="Favoritos + marcador exacto — paga bien si todo sale" picks={parlays.risky} color="var(--color-accent)" />

      <div className="text-xs text-center py-2" style={{ color: 'var(--color-gray-light)', opacity: 0.3 }}>
        Las cuotas son probabilidades justas del modelo (sin margen de la casa). Esto es un ejercicio estadístico, no asesoría financiera.
      </div>
    </div>
  )
}
