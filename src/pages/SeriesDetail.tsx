import { useState } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import type { Series } from '../data/postseason'
import { ROUND_LABELS, gamesToWin } from '../data/postseason'
import type { Team } from '../data/seed'
import { computeLambdas, buildScoreMatrix } from '../engine/poisson'

interface Props {
  series: Series
  teams: Record<string, Team>
  onBack: () => void
}

export default function SeriesDetail({ series, teams, onBack }: Props) {
  const { registerSeriesGame, clearSeriesGame } = useStore()
  const higher = teams[series.higherSeedId]
  const lower = teams[series.lowerSeedId]
  const need = gamesToWin(series.bestOf)

  const higherWins = series.games.filter((g) => {
    if (g.homeRuns == null || g.awayRuns == null) return false
    const homeIsHigher = g.homeId === series.higherSeedId
    return (g.homeRuns > g.awayRuns) === homeIsHigher
  }).length
  const lowerWins = series.games.filter((g) => g.homeRuns != null && g.awayRuns != null).length - higherWins

  const matrix = higher && lower ? buildScoreMatrix(...(() => {
    const r = computeLambdas(higher, lower)
    return [r.lambdaHome, r.lambdaAway] as const
  })()) : null

  const pct = (n: number) => (n * 100).toFixed(0) + '%'

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--color-gray-light)' }}>
        ← Volver a Postemporada
      </button>

      <div className="rounded-xl p-6 mb-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <div className="text-xs mb-4" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
          {ROUND_LABELS[series.round]} · Al mejor de {series.bestOf}
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center flex-1 flex flex-col items-center gap-2">
            {higher ? (
              <>
                <TeamBadge team={higher} size="xl" />
                <p className="font-black text-xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{higher.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Seed #{series.higherSeedNum} · Elo {higher.elo}</p>
              </>
            ) : <p className="opacity-40">?</p>}
          </div>
          <div className="text-center shrink-0">
            <div className="font-black text-5xl" style={{ color: 'var(--color-accent)' }}>{higherWins} – {lowerWins}</div>
            <p className="text-xs mt-1" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>{need} triunfos para avanzar</p>
            {series.winnerId && (
              <p className="text-sm font-bold mt-1" style={{ color: 'var(--color-positive)' }}>
                Avanza: {teams[series.winnerId]?.name}
              </p>
            )}
          </div>
          <div className="text-center flex-1 flex flex-col items-center gap-2">
            {lower ? (
              <>
                <TeamBadge team={lower} size="xl" />
                <p className="font-black text-xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{lower.name}</p>
                <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Seed #{series.lowerSeedNum} · Elo {lower.elo}</p>
              </>
            ) : <p className="opacity-40">?</p>}
          </div>
        </div>
      </div>

      {matrix && (
        <div className="rounded-xl p-5 mb-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="font-bold text-lg uppercase mb-3" style={{ color: 'var(--color-gray-light)' }}>Probabilidad por juego (local vs visitante, según sede)</h3>
          <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
            {higher.id} de local: {pct(matrix.probHome)} · {lower.id} de local: {pct(matrix.probAway)}
          </p>
        </div>
      )}

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <h3 className="font-bold text-lg uppercase mb-4" style={{ color: 'var(--color-gray-light)' }}>Juegos</h3>
        <div className="space-y-2">
          {series.games.map((g) => (
            <GameRow key={g.gameNum} seriesId={series.id} game={g} teams={teams}
              onSave={(h, a) => registerSeriesGame(series.id, g.gameNum, h, a)}
              onClear={() => clearSeriesGame(series.id, g.gameNum)}
              disabled={!!series.winnerId && g.homeRuns == null} />
          ))}
        </div>
      </div>
    </div>
  )
}

function GameRow({ game, teams, onSave, onClear, disabled }: {
  seriesId: string
  game: Series['games'][number]
  teams: Record<string, Team>
  onSave: (h: number, a: number) => void
  onClear: () => void
  disabled: boolean
}) {
  const [h, setH] = useState(game.homeRuns != null ? String(game.homeRuns) : '')
  const [a, setA] = useState(game.awayRuns != null ? String(game.awayRuns) : '')
  const played = game.homeRuns != null && game.awayRuns != null
  const home = teams[game.homeId], away = teams[game.awayId]

  return (
    <div className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <span className="text-xs font-bold w-16" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Juego {game.gameNum}</span>
      <TeamBadge team={away} size="sm" /><span className="text-sm" style={{ color: 'var(--color-gray-light)' }}>{away?.id} @ {home?.id}</span>
      <TeamBadge team={home} size="sm" />
      <div className="flex-1" />
      <input type="number" min="0" max="30" value={a} onChange={(e) => setA(e.target.value)} disabled={disabled}
        className="w-12 text-center rounded px-1 py-1 text-sm font-bold outline-none"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
      <span style={{ color: 'var(--color-gray-dark)' }}>–</span>
      <input type="number" min="0" max="30" value={h} onChange={(e) => setH(e.target.value)} disabled={disabled}
        className="w-12 text-center rounded px-1 py-1 text-sm font-bold outline-none"
        style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
      <button onClick={() => { const hn = parseInt(h, 10), an = parseInt(a, 10); if (!isNaN(hn) && !isNaN(an) && hn !== an) onSave(hn, an) }}
        disabled={disabled || h === '' || a === '' || h === a}
        className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-primary)', color: 'white', opacity: disabled ? 0.3 : 1 }}>
        Guardar
      </button>
      {played && (
        <button onClick={onClear} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-accent)' }}>
          Borrar
        </button>
      )}
    </div>
  )
}
