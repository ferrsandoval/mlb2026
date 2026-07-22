// =============================================================================
// backtest.ts — Walk-forward backtest y grid-search de hiperparámetros
// =============================================================================
// Metodología: walk-forward sin fuga de datos. Para cada juego i, se entrena
// con los juegos 0..i-1 y se evalúa en i.
// =============================================================================

import type { HistGame } from '../data/histTypes'
import { gameOutcome } from '../data/histTypes'
import { brier, logLoss } from './scoring'
import type { Probs2, GameResult } from './scoring'

export type Predictor = (homeId: string, awayId: string) => Probs2

export type PredictorFactory = (
  params: Record<string, number>,
  prior: HistGame[],
) => Predictor

export interface BacktestEntry {
  date: string
  homeId: string
  awayId: string
  probs: Probs2
  result: GameResult
  brier: number
  logLoss: number
}

export interface BacktestResult {
  n: number
  avgBrier: number
  avgLogLoss: number
  entries: BacktestEntry[]
}

export interface GridSearchRow {
  params: Record<string, number>
  avgBrier: number
  avgLogLoss: number
}

export interface GridSearchResult {
  best: Record<string, number>
  bestBrier: number
  rows: GridSearchRow[]
}

export function walkForwardBacktest(
  games: HistGame[],
  factory: PredictorFactory,
  params: Record<string, number>,
  minPrior = 0,
): BacktestResult {
  const entries: BacktestEntry[] = []

  for (let i = minPrior; i < games.length; i++) {
    const g = games[i]
    const prior = games.slice(0, i)
    const predictor = factory(params, prior)
    const probs = predictor(g.homeId, g.awayId)
    const result = gameOutcome(g)

    entries.push({
      date: g.date,
      homeId: g.homeId,
      awayId: g.awayId,
      probs,
      result,
      brier: brier(probs, result),
      logLoss: logLoss(probs, result),
    })
  }

  const n = entries.length
  if (n === 0) return { n: 0, avgBrier: 0, avgLogLoss: 0, entries: [] }

  return {
    n,
    avgBrier:   entries.reduce((s, e) => s + e.brier, 0)   / n,
    avgLogLoss: entries.reduce((s, e) => s + e.logLoss, 0) / n,
    entries,
  }
}

export function gridSearch(
  games: HistGame[],
  paramGrid: Record<string, number>[],
  factory: PredictorFactory,
  minPrior = 0,
): GridSearchResult {
  if (paramGrid.length === 0) return { best: {}, bestBrier: Infinity, rows: [] }

  const rows: GridSearchRow[] = paramGrid.map((params) => {
    const result = walkForwardBacktest(games, factory, params, minPrior)
    return { params, avgBrier: result.avgBrier, avgLogLoss: result.avgLogLoss }
  })

  rows.sort((a, b) => a.avgBrier - b.avgBrier)

  return { best: rows[0].params, bestBrier: rows[0].avgBrier, rows }
}

export function cartesianGrid(grid: Record<string, number[]>): Record<string, number>[] {
  const keys = Object.keys(grid)
  const values = keys.map((k) => grid[k])
  const results: Record<string, number>[] = []

  function recurse(depth: number, current: Record<string, number>) {
    if (depth === keys.length) { results.push({ ...current }); return }
    for (const v of values[depth]) {
      current[keys[depth]] = v
      recurse(depth + 1, current)
    }
  }

  recurse(0, {})
  return results
}
