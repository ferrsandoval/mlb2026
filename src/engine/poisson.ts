// =============================================================================
// poisson.ts — Motor estadístico central: carreras esperadas y matriz de marcador
// -----------------------------------------------------------------------------
// Adaptado del modelo de goles de fútbol a carreras de béisbol. Se usa Poisson
// independiente por equipo (sin corrección Dixon-Coles: esa corrección modela
// una correlación específica de marcadores bajos de fútbol que no aplica a la
// distribución de carreras de béisbol).
// =============================================================================

import type { Team, Game } from '../data/seed'
import type { GamePrediction, Scoreline } from '../types'

export const ENGINE_PARAMS = {
  HOME_ELO_BONUS: 24,   // ventaja de localía en puntos Elo (todo equipo es local en casa)
  RUN_BASE: 4.3,        // carreras esperadas por equipo, liga promedio, por juego
  ELO_DIVISOR: 200,
  GRID_MAX: 14,         // marcadores de 0..13 carreras cubren >99.9% de la masa
  MIN_LAMBDA: 0.5,
}

// ─── Poisson ──────────────────────────────────────────────────────────────────

export function poissonPmf(lambda: number, k: number): number {
  if (k < 0 || !Number.isInteger(k)) return 0
  let logP = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) logP -= Math.log(i)
  return Math.exp(logP)
}

// ─── λ desde Elo ──────────────────────────────────────────────────────────────

export interface LambdaResult {
  lambdaHome: number
  lambdaAway: number
}

/**
 * Carreras esperadas usando Elo (supremacía base) × factor ataque/defensa
 * por equipo (media geométrica, mismo enfoque que el modelo de fútbol).
 */
export function computeLambdas(
  homeTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  awayTeam: Pick<Team, 'elo' | 'attack' | 'defense'>,
  params = ENGINE_PARAMS,
): LambdaResult {
  const d = (homeTeam.elo + params.HOME_ELO_BONUS) - awayTeam.elo
  const supremacy = d / params.ELO_DIVISOR
  const B = params.RUN_BASE

  const adjHome = Math.sqrt(homeTeam.attack * awayTeam.defense)
  const adjAway = Math.sqrt(awayTeam.attack * homeTeam.defense)

  const lambdaHome = Math.max(params.MIN_LAMBDA, (B + supremacy / 2) * adjHome)
  const lambdaAway = Math.max(params.MIN_LAMBDA, (B - supremacy / 2) * adjAway)

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

  const pmfHome = Array.from({ length: N }, (_, k) => poissonPmf(lambdaHome, k))
  const pmfAway = Array.from({ length: N }, (_, k) => poissonPmf(lambdaAway, k))

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
): GamePrediction {
  const { lambdaHome, lambdaAway } = computeLambdas(homeTeam, awayTeam, params)
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
): Record<string, GamePrediction> {
  const result: Record<string, GamePrediction> = {}
  for (const g of games) {
    const home = teamsById[g.homeId]
    const away = teamsById[g.awayId]
    if (home && away) result[g.id] = predictGame(g, home, away)
  }
  return result
}
