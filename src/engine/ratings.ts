// =============================================================================
// ratings.ts — Maher attack/defense MLE con decaimiento temporal y shrinkage
// =============================================================================
// Mismo enfoque que el modelo de fútbol (Maher, 1982), aplicado a carreras:
//   log(λ_home) = log(μ) + α_home + β_away + homeAdv
//   log(λ_away) = log(μ) + α_away + β_home
//
// A diferencia del fútbol internacional (con múltiples competencias de
// distinto nivel), en MLB casi todos los juegos históricos son de temporada
// regular con el mismo nivel competitivo — el peso por tipo de competencia
// se simplifica a 3 niveles fijos (ver compWeight).
// =============================================================================

import type { HistGame } from '../data/histTypes'
import type { Game } from '../data/seed'
import type { GamePrediction } from '../types'
import { buildScoreMatrix } from './poisson'
import type { PredictorFactory } from './backtest'

export interface TeamRating {
  attack: number
  defense: number
  n: number
}

export type RatingMap = Record<string, TeamRating>

export interface MaherParams {
  xi: number
  tauPrior: number
  homeAdv: number
  refDate: string
  maxIter?: number
}

export const DEFAULT_MAHER_PARAMS: MaherParams = {
  xi: 0.002,
  tauPrior: 20,
  homeAdv: 0.10,
  refDate: new Date().toISOString().slice(0, 10),
}

function compWeight(comp: string): number {
  const c = comp.toLowerCase()
  if (c.includes('postseason') || c.includes('playoff') || c.includes('world series')) return 1.2
  if (c.includes('spring')) return 0.2
  return 1.0
}

function daysBetween(dateA: string, dateB: string): number {
  return (new Date(dateB).getTime() - new Date(dateA).getTime()) / 86_400_000
}

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Estima los ratings Maher de ataque/defensa a partir de juegos históricos.
 *
 * @param fallback  Equipos sin historial: attack/defense del seed (escala
 *                  lineal), convertidos a log automáticamente.
 */
export function estimateRatings(
  games: HistGame[],
  params: MaherParams,
  fallback: Record<string, { attack: number; defense: number }> = {},
): RatingMap {
  if (games.length === 0) return buildFallbackMap(fallback)

  const maxIter = params.maxIter ?? 30
  const tau = params.tauPrior
  const ha0 = params.homeAdv

  const teamSet = new Set<string>()
  for (const g of games) { teamSet.add(g.homeId); teamSet.add(g.awayId) }
  const teams = [...teamSet]

  const weights = games.map((g) =>
    compWeight(g.comp) * Math.exp(-params.xi * Math.max(0, daysBetween(g.date, params.refDate))),
  )

  const priorAlpha: Record<string, number> = Object.fromEntries(
    teams.map((t) => [t, fallback[t] ? Math.log(Math.max(0.1, fallback[t].attack)) : 0]),
  )
  const priorBeta: Record<string, number> = Object.fromEntries(
    teams.map((t) => [t, fallback[t] ? Math.log(Math.max(0.1, fallback[t].defense)) : 0]),
  )

  const alpha: Record<string, number> = { ...priorAlpha }
  const beta:  Record<string, number> = { ...priorBeta }

  for (let iter = 0; iter < maxIter; iter++) {
    for (const team of teams) {
      let grad = -tau * (alpha[team] - priorAlpha[team])
      let hess = -tau
      for (let k = 0; k < games.length; k++) {
        const g = games[k], w = weights[k]
        const ha = g.neutral ? 0 : ha0
        if (g.homeId === team) {
          const lam = Math.exp(alpha[team] + beta[g.awayId] + ha)
          grad += w * (g.homeRuns - lam)
          hess -= w * lam
        }
        if (g.awayId === team) {
          const lam = Math.exp(alpha[team] + beta[g.homeId])
          grad += w * (g.awayRuns - lam)
          hess -= w * lam
        }
      }
      if (hess < -1e-10) alpha[team] = clamp(alpha[team] - grad / hess, -1.5, 1.5)
    }

    for (const team of teams) {
      let grad = -tau * (beta[team] - priorBeta[team])
      let hess = -tau
      for (let k = 0; k < games.length; k++) {
        const g = games[k], w = weights[k]
        const ha = g.neutral ? 0 : ha0
        if (g.awayId === team) {
          const lam = Math.exp(alpha[g.homeId] + beta[team] + ha)
          grad += w * (g.homeRuns - lam)
          hess -= w * lam
        }
        if (g.homeId === team) {
          const lam = Math.exp(alpha[g.awayId] + beta[team])
          grad += w * (g.awayRuns - lam)
          hess -= w * lam
        }
      }
      if (hess < -1e-10) beta[team] = clamp(beta[team] - grad / hess, -1.5, 1.5)
    }

    const mA = teams.reduce((s, t) => s + alpha[t], 0) / teams.length
    const mB = teams.reduce((s, t) => s + beta[t],  0) / teams.length
    for (const t of teams) { alpha[t] -= mA; beta[t] -= mB }
  }

  const nMap: Record<string, number> = Object.fromEntries(teams.map((t) => [t, 0]))
  for (let k = 0; k < games.length; k++) {
    nMap[games[k].homeId] += weights[k]
    nMap[games[k].awayId] += weights[k]
  }

  const result: RatingMap = {}
  for (const t of teams) result[t] = { attack: alpha[t], defense: beta[t], n: nMap[t] }

  for (const [id, team] of Object.entries(fallback)) {
    if (!(id in result)) {
      result[id] = { attack: Math.log(Math.max(0.1, team.attack)), defense: Math.log(Math.max(0.1, team.defense)), n: 0 }
    }
  }

  return result
}

function buildFallbackMap(fallback: Record<string, { attack: number; defense: number }>): RatingMap {
  const result: RatingMap = {}
  for (const [id, team] of Object.entries(fallback)) {
    result[id] = { attack: Math.log(Math.max(0.1, team.attack)), defense: Math.log(Math.max(0.1, team.defense)), n: 0 }
  }
  return result
}

export function computeLambdasMaher(
  homeId: string,
  awayId: string,
  ratings: RatingMap,
  homeAdv: number,
  runBase = 4.3,
): { lambdaHome: number; lambdaAway: number } {
  const h = ratings[homeId] ?? { attack: 0, defense: 0, n: 0 }
  const a = ratings[awayId] ?? { attack: 0, defense: 0, n: 0 }
  return {
    lambdaHome: Math.max(0.5, runBase * Math.exp(h.attack + a.defense + homeAdv)),
    lambdaAway: Math.max(0.5, runBase * Math.exp(a.attack + h.defense)),
  }
}

export function predictAllMaher(
  games: Game[],
  ratings: RatingMap,
  homeAdv: number,
): Record<string, GamePrediction> {
  const result: Record<string, GamePrediction> = {}
  for (const g of games) {
    const { lambdaHome, lambdaAway } = computeLambdasMaher(g.homeId, g.awayId, ratings, homeAdv)
    const m = buildScoreMatrix(lambdaHome, lambdaAway)
    result[g.id] = {
      gameId: g.id, homeId: g.homeId, awayId: g.awayId,
      lambdaHome, lambdaAway,
      probHome: m.probHome, probAway: m.probAway,
      probOver: m.probOver, probUnder: m.probUnder, runLine: m.runLine,
      probHomeMinus15: m.probHomeMinus15, probAwayPlus15: m.probAwayPlus15,
      topScorelines: m.topScorelines,
    }
  }
  return result
}

/** PredictorFactory para el backtest walk-forward (ver backtest.ts). */
export function maherFactory(
  seedFallback: Record<string, { attack: number; defense: number }>,
  refDate: string,
): PredictorFactory {
  return (params, prior) => {
    const maherParams: MaherParams = {
      xi:       params['xi']       ?? DEFAULT_MAHER_PARAMS.xi,
      tauPrior: params['tauPrior'] ?? DEFAULT_MAHER_PARAMS.tauPrior,
      homeAdv:  params['homeAdv'] ?? DEFAULT_MAHER_PARAMS.homeAdv,
      refDate,
      maxIter: 20,
    }
    const ratings = estimateRatings(prior, maherParams, seedFallback)

    return (homeId, awayId) => {
      const { lambdaHome, lambdaAway } = computeLambdasMaher(homeId, awayId, ratings, maherParams.homeAdv)
      const m = buildScoreMatrix(lambdaHome, lambdaAway)
      return [m.probHome, m.probAway]
    }
  }
}
