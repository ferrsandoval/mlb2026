import { useState } from 'react'
import { useStore } from '../store/useStore'
import TeamBadge from '../components/TeamBadge'
import ValueBadge from '../components/ValueBadge'
import type { Game, Team } from '../data/seed'
import type { GamePrediction, OddsInput } from '../types'
import { analyzeValue } from '../engine/value'
import { parkFactor } from '../engine/parkFactors'
import BaseballIcon from '../components/BaseballIcon'

interface Props {
  game: Game
  homeTeam: Team
  awayTeam: Team
  prediction: GamePrediction
  onBack: () => void
}

export default function GameDetail({ game, homeTeam, awayTeam, prediction, onBack }: Props) {
  const { odds, setOdds, valueThreshold, kellyFraction, registerResult } = useStore()
  const pitchers = useStore((s) => s.pitchers)
  const homePitcher = game.homePitcherId ? pitchers[game.homePitcherId] : undefined
  const awayPitcher = game.awayPitcherId ? pitchers[game.awayPitcherId] : undefined

  const storedOdds = odds[game.id] ?? { home: null, away: null }

  const [localOdds, setLocalOdds] = useState<OddsInput>(storedOdds)
  const [resHome, setResHome] = useState<string>(game.homeRuns != null ? String(game.homeRuns) : '')
  const [resAway, setResAway] = useState<string>(game.awayRuns != null ? String(game.awayRuns) : '')

  const handleOddsChange = (key: keyof OddsInput, val: string) => {
    const num = val === '' ? null : parseFloat(val)
    const updated = { ...localOdds, [key]: num }
    setLocalOdds(updated)
    setOdds(game.id, updated)
  }

  const valueAnalysis = analyzeValue(
    localOdds,
    { home: prediction.probHome, away: prediction.probAway },
    valueThreshold,
    kellyFraction,
  )

  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  const fmt2 = (n: number) => n.toFixed(2)

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--color-gray-light)' }}>
        ← Volver al calendario
      </button>

      {/* Encabezado */}
      <div className="rounded-xl p-6 mb-4" style={{ backgroundColor: 'var(--color-bg-card)' }}>
        <div className="text-xs mb-4" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
          {game.date} · {homeTeam.venue}, {homeTeam.city}
          {(() => { const pf = parkFactor(homeTeam.id); return pf !== 1 ? ` · Parque ×${pf.toFixed(2)} (${pf > 1 ? 'ofensivo' : 'pitcher-friendly'})` : '' })()}
        </div>
        <div className="flex items-center justify-center gap-6">
          <div className="text-center flex-1 flex flex-col items-center gap-2">
            <TeamBadge team={homeTeam} size="xl" />
            <p className="font-black text-2xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{homeTeam.name}</p>
            <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Elo {homeTeam.elo}</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-primary-light)' }}>λ {fmt2(prediction.lambdaHome)}</p>
            {homePitcher ? (
              <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
                <BaseballIcon size={11} /> {homePitcher.name} · FIP {fmt2(homePitcher.fip)}
              </p>
            ) : !game.played && (
              <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}><BaseballIcon size={11} /> Abridor por confirmar</p>
            )}
          </div>
          <div className="text-center shrink-0">
            {game.played ? (
              <div className="font-black text-5xl" style={{ color: 'var(--color-accent)' }}>{game.homeRuns} – {game.awayRuns}</div>
            ) : (
              <div className="font-black text-5xl" style={{ color: 'var(--color-gray-dark)' }}>vs</div>
            )}
          </div>
          <div className="text-center flex-1 flex flex-col items-center gap-2">
            <TeamBadge team={awayTeam} size="xl" />
            <p className="font-black text-2xl uppercase" style={{ color: 'var(--color-gray-light)' }}>{awayTeam.name}</p>
            <p className="text-sm" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>Elo {awayTeam.elo}</p>
            <p className="text-lg font-bold" style={{ color: 'var(--color-accent)' }}>λ {fmt2(prediction.lambdaAway)}</p>
            {awayPitcher ? (
              <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
                <BaseballIcon size={11} /> {awayPitcher.name} · FIP {fmt2(awayPitcher.fip)}
              </p>
            ) : !game.played && (
              <p className="text-xs flex items-center justify-center gap-1" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}><BaseballIcon size={11} /> Abridor por confirmar</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Probabilidades */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="font-bold text-lg uppercase mb-4" style={{ color: 'var(--color-gray-light)' }}>Probabilidades</h3>
          <div className="space-y-3">
            {[
              { label: homeTeam.name, prob: prediction.probHome, color: 'var(--color-primary)', ml: game.mlHome },
              { label: awayTeam.name, prob: prediction.probAway, color: 'var(--color-accent)', ml: game.mlAway },
            ].map(({ label, prob, color, ml }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1" style={{ color: 'var(--color-gray-light)' }}>
                  <span>{label}{ml != null && <span style={{ opacity: 0.55 }}> · casa {ml > 0 ? `+${ml}` : ml}</span>}</span>
                  <span className="font-bold">{pct(prob)}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
                  <div className="h-full rounded-full" style={{ width: pct(prob), backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            {[
              { label: `Over ${prediction.runLine}`, val: pct(prediction.probOver) },
              { label: `Under ${prediction.runLine}`, val: pct(prediction.probUnder) },
              { label: `${homeTeam.id} -1.5`, val: pct(prediction.probHomeMinus15) },
              { label: `${awayTeam.id} +1.5`, val: pct(prediction.probAwayPlus15) },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg px-3 py-2 text-center" style={{ backgroundColor: 'var(--color-bg-base)' }}>
                <p className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>{label}</p>
                <p className="font-bold text-base" style={{ color: 'var(--color-gray-light)' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top marcadores */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="font-bold text-lg uppercase mb-4" style={{ color: 'var(--color-gray-light)' }}>Top 5 Marcadores</h3>
          <div className="space-y-2">
            {prediction.topScorelines.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs w-4" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>{i + 1}</span>
                <span className="font-black text-xl w-16 text-center rounded-lg py-1" style={{ backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-bg-base)', color: 'var(--color-gray-light)' }}>
                  {s.home}–{s.away}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-base)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(s.prob / prediction.topScorelines[0].prob) * 100}%`, backgroundColor: i === 0 ? 'var(--color-primary)' : 'var(--color-gray-dark)' }} />
                </div>
                <span className="text-sm font-bold w-12 text-right" style={{ color: 'var(--color-gray-light)' }}>{pct(s.prob)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Registrar resultado real */}
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="font-bold text-lg uppercase mb-4" style={{ color: 'var(--color-gray-light)' }}>
            {game.played ? 'Resultado' : 'Registrar Resultado'}
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold" style={{ color: 'var(--color-gray-light)' }}>{homeTeam.id}</span>
            <input type="number" min="0" max="30" value={resHome} onChange={(e) => setResHome(e.target.value)}
              className="w-14 text-center rounded-lg px-2 py-2 text-lg font-black outline-none"
              style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
            <span className="font-black text-2xl" style={{ color: 'var(--color-gray-dark)' }}>–</span>
            <input type="number" min="0" max="30" value={resAway} onChange={(e) => setResAway(e.target.value)}
              className="w-14 text-center rounded-lg px-2 py-2 text-lg font-black outline-none"
              style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--color-gray-light)' }}>{awayTeam.id}</span>
            <button
              onClick={() => {
                const h = parseInt(resHome, 10), a = parseInt(resAway, 10)
                if (!isNaN(h) && !isNaN(a) && h !== a) registerResult(game.id, h, a)
              }}
              disabled={resHome === '' || resAway === '' || resHome === resAway}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ backgroundColor: 'var(--color-positive)', color: 'white', opacity: resHome !== '' && resAway !== '' && resHome !== resAway ? 1 : 0.4 }}>
              Guardar y Recalcular Elo
            </button>
          </div>
        </div>

        {/* Comparador de valor */}
        <div className="rounded-xl p-5 md:col-span-2" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <h3 className="font-bold text-lg uppercase mb-4" style={{ color: 'var(--color-gray-light)' }}>Comparador de Valor (Moneyline)</h3>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {(['home', 'away'] as const).map((key) => {
              const labels = { home: homeTeam.id, away: awayTeam.id }
              return (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>{labels[key]}</label>
                  <input type="number" min="1.01" step="0.01" placeholder="1.90" value={localOdds[key] ?? ''}
                    onChange={(e) => handleOddsChange(key, e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm font-bold outline-none"
                    style={{ backgroundColor: 'var(--color-bg-base)', color: 'var(--color-gray-light)', border: '1px solid var(--color-primary)' }} />
                </div>
              )
            })}
          </div>
          {valueAnalysis ? (
            <div className="space-y-2">
              <p className="text-xs mb-3" style={{ color: 'var(--color-gray-light)', opacity: 0.5 }}>
                Overround de la casa: {((valueAnalysis.overround - 1) * 100).toFixed(1)}%
              </p>
              {(['home', 'away'] as const).map((key) => {
                const m = valueAnalysis.markets[key]
                const labels = { home: homeTeam.name, away: awayTeam.name }
                return (
                  <div key={key} className="rounded-lg px-4 py-3 flex items-center justify-between gap-4"
                    style={{ backgroundColor: m.hasValue ? 'rgba(46,139,87,0.12)' : 'var(--color-bg-base)', border: m.hasValue ? '1px solid var(--color-positive)' : '1px solid transparent' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-gray-light)', minWidth: '140px' }}>{labels[key]}</span>
                    <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.6 }}>
                      Modelo {pct(m.modelProb)} · Casa {pct(m.impliedFair)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: m.edge >= 0 ? 'var(--color-positive)' : 'var(--color-accent)' }}>
                      {m.edge >= 0 ? '+' : ''}{pct(m.edge)}
                    </span>
                    {m.hasValue && <span className="text-xs" style={{ color: 'var(--color-gray-light)', opacity: 0.7 }}>Kelly {pct(m.halfKelly)}</span>}
                    <ValueBadge edge={m.edge} hasValue={m.hasValue} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: 'var(--color-gray-light)', opacity: 0.4 }}>Ingresa las dos cuotas moneyline para ver el análisis de valor</p>
          )}
        </div>
      </div>
    </div>
  )
}
