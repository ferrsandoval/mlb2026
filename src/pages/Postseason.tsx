import { useState, memo } from 'react'
import { useStore, currentWinsByTeam } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import SeriesDetail from './SeriesDetail'
import type { Series, PostseasonRound } from '../data/postseason'
import { ROUND_LABELS, gamesToWin } from '../data/postseason'
import type { Team, League } from '../data/seed'
import { runMonteCarlo } from '../engine/montecarlo'
import type { MCResult } from '../engine/montecarlo'

const ROUND_ORDER: PostseasonRound[] = ['WC', 'LDS', 'LCS', 'WS']

function MonteCarloPanel() {
  const teams = useStore((s) => s.teams)
  const games = useStore((s) => s.games)
  const [result, setResult] = useState<MCResult | null>(null)
  const [running, setRunning] = useState(false)

  const handleRun = () => {
    setRunning(true)
    setTimeout(() => {
      const remaining = games.filter((g) => !g.played).map((g) => ({ homeId: g.homeId, awayId: g.awayId }))
      const wins = currentWinsByTeam(teams, games)
      const r = runMonteCarlo(teams, remaining, wins, { n: 1500 })
      setResult(r)
      setRunning(false)
    }, 10)
  }

  const rows = result
    ? Object.keys(teams)
        .map((id) => ({
          team: teams[id],
          madePlayoffs: result.madePlayoffs[id] ?? 0,
          divisionWinner: result.divisionWinner[id] ?? 0,
          wonPennant: result.wonPennant[id] ?? 0,
          champion: result.champion[id] ?? 0,
        }))
        .sort((a, b) => b.champion - a.champion || b.madePlayoffs - a.madePlayoffs)
        .slice(0, 12)
    : []

  return (
    <div className="rounded-xl p-5 mt-8" style={{ backgroundColor: 'var(--color-bg-card)' }}>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h3 className="font-black text-xl uppercase" style={{ color: 'var(--color-gray-light)' }}>Probabilidades Monte Carlo</h3>
        <button onClick={handleRun} disabled={running}
          className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: running ? 0.6 : 1 }}>
          {running ? 'Calculando…' : 'Calcular (1 500 simulaciones)'}
        </button>
        <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Simula el resto de la temporada + postemporada completa</span>
      </div>
      {result && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '480px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <th className="text-left px-2 py-1.5 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Equipo</th>
                <th className="text-center px-2 py-1.5 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Postemporada</th>
                <th className="text-center px-2 py-1.5 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>División</th>
                <th className="text-center px-2 py-1.5 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Banderín</th>
                <th className="text-center px-2 py-1.5 text-xs uppercase font-bold opacity-50" style={{ color: 'var(--color-gray-light)' }}>Campeón</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <TeamBadge team={r.team} size="sm" />
                      <span className="font-bold" style={{ color: 'var(--color-gray-light)' }}>{r.team.name}</span>
                    </div>
                  </td>
                  <td className="text-center px-2 py-1.5" style={{ color: 'var(--color-gray-light)' }}>{(r.madePlayoffs * 100).toFixed(1)}%</td>
                  <td className="text-center px-2 py-1.5" style={{ color: 'var(--color-gray-light)' }}>{(r.divisionWinner * 100).toFixed(1)}%</td>
                  <td className="text-center px-2 py-1.5" style={{ color: 'var(--color-gray-light)' }}>{(r.wonPennant * 100).toFixed(1)}%</td>
                  <td className="text-center px-2 py-1.5 font-black" style={{ color: 'var(--color-positive)' }}>{(r.champion * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const SeriesCard = memo(function SeriesCard({ series, teams, onClick }: { series: Series; teams: Record<string, Team>; onClick: () => void }) {
  const higher = teams[series.higherSeedId]
  const lower = teams[series.lowerSeedId]
  const need = gamesToWin(series.bestOf)
  const higherWins = series.games.filter((g) => {
    if (g.homeRuns == null || g.awayRuns == null) return false
    return (g.homeRuns > g.awayRuns) === (g.homeId === series.higherSeedId)
  }).length
  const lowerWins = series.games.filter((g) => g.homeRuns != null && g.awayRuns != null).length - higherWins

  if (!higher || !lower) return null

  return (
    <button onClick={onClick} className="w-full text-left rounded-lg p-3 transition-colors" style={{ backgroundColor: 'var(--color-bg-card)', border: '1px solid rgba(255,255,255,0.08)' }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-card)')}>
      <div className="flex items-center justify-between text-xs mb-2" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>
        <span>Al mejor de {series.bestOf}</span>
        {series.winnerId && <span style={{ color: 'var(--color-positive)' }}>✓ {teams[series.winnerId]?.id} avanza</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TeamBadge team={higher} size="sm" />
          <span className="text-sm font-bold" style={{ color: series.winnerId === higher.id ? 'var(--color-positive)' : 'var(--color-gray-light)' }}>#{series.higherSeedNum} {higher.id}</span>
        </div>
        <span className="font-black text-lg" style={{ color: 'var(--color-accent)' }}>{higherWins}-{lowerWins}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: series.winnerId === lower.id ? 'var(--color-positive)' : 'var(--color-gray-light)' }}>#{series.lowerSeedNum} {lower.id}</span>
          <TeamBadge team={lower} size="sm" />
        </div>
      </div>
      <div className="text-center text-xs mt-1" style={{ color: 'var(--color-gray-light)', opacity: 0.3 }}>{need} triunfos para avanzar</div>
    </button>
  )
})

function RoundSection({ round, series, teams, onSelect }: { round: PostseasonRound; series: Series[]; teams: Record<string, Team>; onSelect: (id: string) => void }) {
  if (series.length === 0) return null
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>{ROUND_LABELS[round]}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {series.map((s) => <SeriesCard key={s.id} series={s} teams={teams} onClick={() => onSelect(s.id)} />)}
      </div>
    </div>
  )
}

export default function Postseason() {
  const teams = useStore((s) => s.teams)
  const postseasonSeries = useStore((s) => s.postseasonSeries)
  const generatePostseason = useStore((s) => s.generatePostseason)
  const autoAdvancePostseason = useStore((s) => s.autoAdvancePostseason)
  const resetPostseason = useStore((s) => s.resetPostseason)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  if (selectedId) {
    const series = postseasonSeries.find((s) => s.id === selectedId)!
    return <SeriesDetail series={series} teams={teams} onBack={() => setSelectedId(null)} />
  }

  const byLeague = (league: League) => postseasonSeries.filter((s) => s.league === league)
  const worldSeries = postseasonSeries.filter((s) => s.round === 'WS')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={() => generatePostseason()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
          Generar desde posiciones actuales
        </button>
        <button onClick={() => autoAdvancePostseason()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ backgroundColor: 'var(--color-positive)', color: 'white' }}>
          Avanzar favoritos
        </button>
        <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Genera la ronda de Comodín y proyecta ronda por ronda al favorito del modelo</span>
        <div className="flex-1" />
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="px-3 py-1 rounded-lg text-xs" style={{ backgroundColor: 'transparent', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
            Reiniciar
          </button>
        ) : (
          <div className="flex gap-2 items-center">
            <span className="text-xs" style={{ color: '#f87171' }}>¿Confirmar?</span>
            <button onClick={() => { resetPostseason(); setConfirmReset(false) }} className="px-3 py-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Sí</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1 rounded-lg text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)' }}>Cancelar</button>
          </div>
        )}
      </div>

      {postseasonSeries.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <p className="font-black text-xl uppercase mb-2" style={{ color: 'var(--color-gray-light)' }}>Sin postemporada generada</p>
          <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
            Presiona "Generar desde posiciones actuales" para armar la ronda de Comodín con los 6 clasificados de cada liga.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {(['AL', 'NL'] as League[]).map((league) => (
            <div key={league} className="space-y-4">
              <h2 className="font-black text-xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{league === 'AL' ? 'Liga Americana' : 'Liga Nacional'}</h2>
              {ROUND_ORDER.filter((r) => r !== 'WS').map((round) => (
                <RoundSection key={round} round={round} series={byLeague(league).filter((s) => s.round === round)} teams={teams} onSelect={setSelectedId} />
              ))}
            </div>
          ))}
        </div>
      )}

      {worldSeries.length > 0 && (
        <div className="mt-8">
          <RoundSection round="WS" series={worldSeries} teams={teams} onSelect={setSelectedId} />
        </div>
      )}

      <MonteCarloPanel />
    </div>
  )
}
