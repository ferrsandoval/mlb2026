// =============================================================================
// poisson.ts — Motor estadístico central: carreras esperadas y matriz de marcador
// -----------------------------------------------------------------------------
// Modelo específico de béisbol. Las carreras por equipo NO son Poisson: están
// sobredispersas (varianza > media) por el efecto "inning grande" — una vez que
// hay corredores en base, anotar se agrupa. Por eso el marcador se modela con
// una BINOMIAL NEGATIVA por equipo (mezcla Poisson-Gamma), que conserva la media
// esperada (λ) pero engorda las colas: predice mejor blanqueadas y palizas, y
// por tanto over/under y marcador exacto. Con RUN_DISPERSION → ∞ se recupera
// Poisson. Los dos equipos se tratan como independientes.
// =============================================================================

import type { Team, Game } from '../data/seed'
import type { GamePrediction, Scoreline } from '../types'

export const ENGINE_PARAMS = {
  HOME_ELO_BONUS: 24,   // ventaja de localía en puntos Elo (todo equipo es local en casa)
  RUN_BASE: 4.3,        // carreras esperadas por equipo, liga promedio, por juego
  ELO_DIVISOR: 200,
  GRID_MAX: 20,         // colas más gruesas que Poisson → rejilla mayor para capturar la masa
  MIN_LAMBDA: 0.5,
  // Parámetro de dispersión r de la Binomial Negativa (var = μ + μ²/r).
  // r≈4 reproduce la desviación estándar real de carreras/equipo/juego (~3.0).
  // Usa Infinity para volver al modelo Poisson.
  RUN_DISPERSION: 4.0,
}

// ─── Función log-gamma (Lanczos) — necesaria para la Binomial Negativa ─────────

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

export function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflexión: Γ(x)Γ(1-x) = π / sin(πx)
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x)
  }
  x -= 1
  let a = LANCZOS[0]
  const t = x + 7.5
  for (let i = 1; i < LANCZOS.length; i++) a += LANCZOS[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

// ─── Distribuciones de carreras ────────────────────────────────────────────────

export function poissonPmf(lambda: number, k: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

/**
 * P(X = k) para X ~ Binomial Negativa con media `mean` y dispersión `size` (r).
 * Var(X) = mean + mean²/r. Con size = ∞ equivale a Poisson(mean).
 */
export function negBinomPmf(mean: number, size: number, k: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0
  if (!Number.isFinite(size)) return poissonPmf(mean, k)
  if (mean <= 0) return k === 0 ? 1 : 0
  const r = size
  const p = r / (r + mean) // "prob de éxito" en la parametrización clásica
  const logP =
    logGamma(k + r) - logGamma(r) - logGamma(k + 1) +
    r * Math.log(p) + k * Math.log(1 - p)
  return Math.exp(logP)
}

/** pmf de carreras del motor: Binomial Negativa (o Poisson si dispersion = ∞). */
export function runPmf(mean: number, k: number, dispersion = ENGINE_PARAMS.RUN_DISPERSION): number {
  return Number.isFinite(dispersion) ? negBinomPmf(mean, dispersion, k) : poissonPmf(mean, k)
}

// ─── λ desde Elo ──────────────────────────────────────────────────────────────

export interface LambdaResult {
  lambdaHome: number
  lambdaAway: number
}

/**
 * Contexto del enfrentamiento que ajusta las carreras esperadas más allá del
 * rating de equipo. `homePitcherFactor` es el factor de supresión del ABRIDOR
 * LOCAL (afecta las carreras del VISITANTE); `awayPitcherFactor`, el del abridor
 * visitante (afecta al local). 1 = neutro (sin dato de abridor). Ver pitchers.ts.
 */
export interface MatchupContext {
  homePitcherFactor?: number
  awayPitcherFactor?: number
  /** Factor de carreras del estadio (multiplica AMBAS λ). 1 = neutral. Ver parkFactors.ts. */
  parkFactor?: number
}

/**
 * Carreras esperadas por equipo. Estructura tipo log5/Maher:
 *   λ_local = base × supremacía(Elo) × ataque_local × defensa_visitante × abridor_visitante
 * El PRODUCTO ataque×defensa (no media geométrica) es la forma estándar de
 * béisbol y hace que este cálculo sea idéntico al de los ratings Maher
 * (attack = e^α, defense = e^β) cuando se calibra con historial. Cada abridor
 * suprime las carreras del equipo RIVAL.
 */
export function computeLambdas(
  homeTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  awayTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  params = ENGINE_PARAMS,
  ctx: MatchupContext = {},
): LambdaResult {
  const d = (homeTeam.elo + params.HOME_ELO_BONUS) - awayTeam.elo
  const supremacy = d / params.ELO_DIVISOR
  const B = params.RUN_BASE

  const offHome = homeTeam.attack * awayTeam.defense
  const offAway = awayTeam.attack * homeTeam.defense

  const suppressHome = ctx.awayPitcherFactor ?? 1 // pitcheo visitante frena al local
  const suppressAway = ctx.homePitcherFactor ?? 1 // pitcheo local frena al visitante
  const park = ctx.parkFactor ?? 1               // entorno del estadio (afecta a ambos)

  const lambdaHome = Math.max(params.MIN_LAMBDA, (B + supremacy / 2) * offHome * suppressHome * park)
  const lambdaAway = Math.max(params.MIN_LAMBDA, (B - supremacy / 2) * offAway * suppressAway * park)

  return { lambdaHome, lambdaAway }
}

// ─── Matriz de marcadores ─────────────────────────────────────────────────────

export interface ScoreMatrix {
  grid: number[][]
  probHome: number
  probAway: number
  /** P(empate al cierre de la 9na) — en MLB nunca queda así, siempre hay extras;
   *  se reporta solo como referencia estadística previa a la resolución de innings extra. */
  probTie9: number
  probOver: number   // P(total de carreras > runLine)
  probUnder: number
  runLine: number    // línea de total usada (default 8.5)
  probHomeMinus15: number  // P(home cubre línea de carreras -1.5, "run line")
  probAwayPlus15: number
  topScorelines: Scoreline[]
}

export function buildScoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  params = ENGINE_PARAMS,
  runLine = 8.5,
): ScoreMatrix {
  const N = params.GRID_MAX
  const grid: number[][] = Array.from({ length: N }, () => new Array(N).fill(0))

  const r = params.RUN_DISPERSION
  const pmfHome = Array.from({ length: N }, (_, k) => runPmf(lambdaHome, k, r))
  const pmfAway = Array.from({ length: N }, (_, k) => runPmf(lambdaAway, k, r))

  let total = 0
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      grid[i][j] = pmfHome[i] * pmfAway[j]
      total += grid[i][j]
    }
  }

  let probHome = 0, probAway = 0, probTie9 = 0
  let probOver = 0, probHomeMinus15 = 0, probAwayPlus15 = 0
  const allScorelines: Scoreline[] = []

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const p = grid[i][j] / total
      grid[i][j] = p

      if (i > j) probHome += p
      else if (i === j) probTie9 += p
      else probAway += p

      if (i + j > runLine) probOver += p
      if (i - j > 1.5) probHomeMinus15 += p
      if (j - i > -1.5) probAwayPlus15 += p

      allScorelines.push({ home: i, away: j, prob: p })
    }
  }

  // Repartir el "empate al cierre de 9" proporcionalmente a home/away
  // (en la realidad se resuelve en innings extra; aproximamos 50/50 ajustado
  // por la ligera ventaja de localía ya presente en lambdaHome).
  const extraInningsHomeShare = lambdaHome / (lambdaHome + lambdaAway)
  probHome += probTie9 * extraInningsHomeShare
  probAway += probTie9 * (1 - extraInningsHomeShare)

  allScorelines.sort((a, b) => b.prob - a.prob)

  return {
    grid,
    probHome,
    probAway,
    probTie9,
    probOver,
    probUnder: 1 - probOver,
    runLine,
    probHomeMinus15,
    probAwayPlus15,
    topScorelines: allScorelines.slice(0, 5),
  }
}

// ─── Predicción completa ──────────────────────────────────────────────────────

export function predictGame(
  game: Pick<Game, 'id' | 'homeId' | 'awayId'>,
  homeTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  awayTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  params = ENGINE_PARAMS,
  ctx: MatchupContext = {},
): GamePrediction {
  const { lambdaHome, lambdaAway } = computeLambdas(homeTeam, awayTeam, params, ctx)
  const matrix = buildScoreMatrix(lambdaHome, lambdaAway, params)

  return {
    gameId: game.id,
    homeId: game.homeId,
    awayId: game.awayId,
    lambdaHome,
    lambdaAway,
    probHome: matrix.probHome,
    probAway: matrix.probAway,
    probOver: matrix.probOver,
    probUnder: matrix.probUnder,
    runLine: matrix.runLine,
    probHomeMinus15: matrix.probHomeMinus15,
    probAwayPlus15: matrix.probAwayPlus15,
    topScorelines: matrix.topScorelines,
  }
}

export function predictAll(
  games: Game[],
  teamsById: Record<string, Team>,
  ctxByGame: Record<string, MatchupContext> = {},
): Record<string, GamePrediction> {
  const result: Record<string, GamePrediction> = {}
  for (const g of games) {
    const home = teamsById[g.homeId]
    const away = teamsById[g.awayId]
    if (home && away) result[g.id] = predictGame(g, home, away, ENGINE_PARAMS, ctxByGame[g.id])
  }
  return result
}
