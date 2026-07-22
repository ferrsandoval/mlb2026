import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import type { GamePrediction } from '../types'
import type { Team } from '../data/seed'

type ResultCheck = 'exact' | 'outcome' | 'miss' | 'sin-pick'

function checkResult(pick: { homeRuns: number; awayRuns: number } | undefined, realHome: number, realAway: number): ResultCheck {
  if (!pick) return 'sin-pick'
  if (pick.homeRuns === realHome && pick.awayRuns === realAway) return 'exact'
  const realOut = realHome > realAway ? 'home' : 'away'
  const pickOut = pick.homeRuns >= pick.awayRuns ? 'home' : 'away'
  return realOut === pickOut ? 'outcome' : 'miss'
}

const BADGE: Record<ResultCheck, { label: string; color: string; bg: string }> = {
  exact:      { label: '✓ Marcador Exacto', color: 'var(--color-positive)', bg: 'rgba(46,139,87,0.15)' },
  outcome:    { label: '~ Acertó Ganador',   color: 'var(--color-warning)',  bg: 'rgba(232,163,23,0.12)' },
  miss:       { label: '✗ Falló',            color: 'var(--color-accent)',   bg: 'rgba(200,16,46,0.10)' },
  'sin-pick': { label: '— Sin predicción',   color: 'rgba(255,255,255,0.25)', bg: 'transparent' },
}

function Badge({ result }: { result: ResultCheck }) {
  const b = BADGE[result]
  return <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: b.color, backgroundColor: b.bg }}>{b.label}</span>
}

function ScoreTally({ exact, outcome, miss, total }: { exact: number; outcome: number; miss: number; total: number }) {
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
  return (
    <div className="flex gap-3 text-sm flex-wrap">
      <span className="font-bold" style={{ color: 'var(--color-positive)' }}>{exact} exacto{exact !== 1 ? 's' : ''}</span>
      <span className="font-bold" style={{ color: 'var(--color-warning)' }}>{outcome} ganador{outcome !== 1 ? 'es' : ''}</span>
      <span style={{ color: 'var(--color-accent)' }}>{miss} fallo{miss !== 1 ? 's' : ''}</span>
      <span style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>· {pct(exact + outcome)}% de acierto</span>
    </div>
  )
}

interface AciertoRow {
  id: string
  homeTeam: Team
  awayTeam: Team
  realHome: number
  realAway: number
  modelResult: ResultCheck
  pickResult: ResultCheck
  modelPick?: { homeRuns: number; awayRuns: number }
  pick?: { homeRuns: number; awayRuns: number }
}

export default function Aciertos() {
  const { games, teams, predictions, personalPicks } = useStore()

  const rows = useMemo(() => {
    const result: AciertoRow[] = []
    for (const g of games) {
      if (!g.played || g.homeRuns == null || g.awayRuns == null) continue
      const pred = predictions[g.id] as GamePrediction | undefined
      const topScore = pred?.topScorelines[0]
      const modelPick = topScore ? { homeRuns: topScore.home, awayRuns: topScore.away } : undefined
      result.push({
        id: g.id,
        homeTeam: teams[g.homeId],
        awayTeam: teams[g.awayId],
        realHome: g.homeRuns,
        realAway: g.awayRuns,
        modelResult: checkResult(modelPick, g.homeRuns, g.awayRuns),
        pickResult: checkResult(personalPicks[g.id], g.homeRuns, g.awayRuns),
        modelPick,
        pick: personalPicks[g.id],
      })
    }
    return result
  }, [games, teams, predictions, personalPicks])

  const modelStats = useMemo(() => ({
    exact: rows.filter((r) => r.modelResult === 'exact').length,
    outcome: rows.filter((r) => r.modelResult === 'outcome').length,
    miss: rows.filter((r) => r.modelResult === 'miss').length,
    total: rows.length,
  }), [rows])

  const pickStats = useMemo(() => ({
    exact: rows.filter((r) => r.pickResult === 'exact').length,
    outcome: rows.filter((r) => r.pickResult === 'outcome').length,
    miss: rows.filter((r) => r.pickResult === 'miss').length,
    total: rows.filter((r) => r.pickResult !== 'sin-pick').length,
  }), [rows])

  if (rows.length === 0) {
    return (
      <div className="text-center py-16" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>
        <p className="text-2xl font-black uppercase mb-2">Sin juegos jugados</p>
        <p className="text-sm">Los aciertos aparecerán aquí cuando se registren resultados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: 'var(--color-bg-card)', borderLeft: '3px solid var(--color-gray-dark)' }}>
          <h3 className="font-black text-xl uppercase" style={{ color: 'var(--color-gray-light)' }}>Modelo</h3>
          <ScoreTally {...modelStats} />
          <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>{modelStats.total} de {rows.length} juegos</p>
        </div>
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: 'var(--color-bg-card)', borderLeft: '3px solid var(--color-accent)' }}>
          <h3 className="font-black text-xl uppercase" style={{ color: 'var(--color-accent)' }}>Tu Predicción</h3>
          <ScoreTally {...pickStats} />
          <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>{pickStats.total} de {rows.length} juegos con predicción</p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map(({ id, homeTeam, awayTeam, realHome, realAway, modelResult, modelPick, pickResult, pick }) => (
          <div key={id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 flex items-center justify-end gap-2">
                <span className="font-black text-base uppercase text-right" style={{ color: 'var(--color-gray-light)' }}>{awayTeam.id} @ {homeTeam.name}</span>
                <TeamBadge team={homeTeam} size="sm" />
              </div>
              <div className="font-black text-2xl px-3 shrink-0" style={{ color: 'var(--color-accent)' }}>{realHome}–{realAway}</div>
              <div className="flex-1 flex items-center gap-2">
                <TeamBadge team={awayTeam} size="sm" />
                <span className="font-black text-base uppercase" style={{ color: 'var(--color-gray-light)' }}>{awayTeam.name}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold w-24 shrink-0" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>Modelo</span>
                {modelPick && <span className="font-black text-lg mr-2" style={{ color: 'var(--color-gray-light)' }}>{modelPick.homeRuns}–{modelPick.awayRuns}</span>}
                <Badge result={modelResult} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold w-24 shrink-0" style={{ color: 'var(--color-accent)' }}>Tu pick</span>
                {pick && <span className="font-black text-lg mr-2" style={{ color: 'var(--color-gray-light)' }}>{pick.homeRuns}–{pick.awayRuns}</span>}
                <Badge result={pickResult} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
