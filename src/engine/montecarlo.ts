// =============================================================================
// montecarlo.ts — Simulación de la temporada + postemporada por Monte Carlo
// -----------------------------------------------------------------------------
// Simula N veces el resto de la temporada regular (162 juegos/equipo) y la
// postemporada completa (Wild Card → Divisional → Campeonato → Serie Mundial),
// devolviendo la probabilidad de cada equipo de clasificar, ganar su división,
// llegar a la Serie Mundial y ser campeón.
//
// Simplificación: los ratings (Elo/ataque/defensa) se mantienen FIJOS durante
// toda la temporada simulada — no se actualiza Elo juego a juego dentro de una
// simulación (sería O(juegos²) por corrida). Es el mismo enfoque que usa el
// simulador de torneo de la versión de fútbol.
// =============================================================================

import type { Team, League } from '../data/seed'
import { ALL_DIVISION_KEYS, DIVISIONS } from '../data/seed'
import { computeLambdas } from './poisson'
import {
  createWildCardRound, createDivisionSeries, createLeagueChampionship, createWorldSeries,
  gamesToWin,
} from '../data/postseason'
import type { Series, SeedEntry } from '../data/postseason'

export interface MCConfig {
  n?: number
  rng?: () => number
}

export interface MCResult {
  n: number
  /** P(clasificar a la postemporada). Suma por liga = 6. */
  madePlayoffs: Record<string, number>
  /** P(ganar su división). Suma por liga = 3. */
  divisionWinner: Record<string, number>
  /** P(ganar el banderín de su liga, llegar a la Serie Mundial). Suma por liga = 1. */
  wonPennant: Record<string, number>
  /** P(ser Campeón de la Serie Mundial). Suma total = 1. */
  champion: Record<string, number>
}

// ─── Muestreo de Poisson (algoritmo de Knuth) ─────────────────────────────────

export function samplePoisson(lambda: number, rng: () => number): number {
  if (lambda <= 0) return 0
  const L = Math.exp(-lambda)
  let k = 0, p = 1
  do { k++; p *= rng() } while (p > L)
  return k - 1
}

// ─── Simular un juego (con resolución de innings extra) ───────────────────────

function simulateGameWinner(
  home: Pick<Team, 'elo' | 'attack' | 'defense'>,
  away: Pick<Team, 'elo' | 'attack' | 'defense'>,
  rng: () => number,
): 'home' | 'away' {
  const { lambdaHome, lambdaAway } = computeLambdas(home, away)
  const hr = samplePoisson(lambdaHome, rng)
  const ar = samplePoisson(lambdaAway, rng)
  if (hr > ar) return 'home'
  if (ar > hr) return 'away'
  return rng() < lambdaHome / (lambdaHome + lambdaAway) ? 'home' : 'away'
}

// ─── Simular una serie de postemporada ────────────────────────────────────────

function simulateSeries(series: Series, teams: Record<string, Team>, rng: () => number): string {
  const need = gamesToWin(series.bestOf)
  let higherWins = 0, lowerWins = 0
  for (const slot of series.games) {
    if (higherWins >= need || lowerWins >= need) break
    const home = teams[slot.homeId], away = teams[slot.awayId]
    if (!home || !away) break
    const winnerSide = simulateGameWinner(home, away, rng)
    const homeIsHigher = slot.homeId === series.higherSeedId
    const higherWon = (winnerSide === 'home') === homeIsHigher
    if (higherWon) higherWins++; else lowerWins++
  }
  return higherWins >= need ? series.higherSeedId : series.lowerSeedId
}

// ─── Una simulación completa de temporada + postemporada ──────────────────────

interface RemainingGame { homeId: string; awayId: string }

interface SeasonSim {
  qualifiers: Record<League, SeedEntry[]>
  divisionWinners: Record<League, string[]>
  pennant: [string, string]
  champion: string
}

function runLeaguePostseason(
  league: League,
  seeds: SeedEntry[],
  teams: Record<string, Team>,
  rng: () => number,
): { teamId: string; seed: number } {
  const wcRound = createWildCardRound(league, seeds)
  const wcWinners = wcRound.map((s) => {
    const winnerId = simulateSeries(s, teams, rng)
    const seed = winnerId === s.higherSeedId ? s.higherSeedNum : s.lowerSeedNum
    return { teamId: winnerId, seed }
  })
  const ldsRound = createDivisionSeries(league, seeds, wcWinners)
  const ldsWinners = ldsRound.map((s) => {
    const winnerId = simulateSeries(s, teams, rng)
    const seed = winnerId === s.higherSeedId ? s.higherSeedNum : s.lowerSeedNum
    return { teamId: winnerId, seed }
  })
  const lcs = createLeagueChampionship(league, ldsWinners)
  const winnerId = simulateSeries(lcs, teams, rng)
  const seed = winnerId === lcs.higherSeedId ? lcs.higherSeedNum : lcs.lowerSeedNum
  return { teamId: winnerId, seed }
}

function simulateOne(
  teams: Record<string, Team>,
  remainingGames: RemainingGame[],
  currentWins: Record<string, number>,
  rng: () => number,
): SeasonSim {
  const wins = { ...currentWins }
  for (const g of remainingGames) {
    const home = teams[g.homeId], away = teams[g.awayId]
    if (!home || !away) continue
    const winnerSide = simulateGameWinner(home, away, rng)
    if (winnerSide === 'home') wins[g.homeId]++
    else wins[g.awayId]++
  }

  const qualifiers = {} as Record<League, SeedEntry[]>
  const divisionWinners = {} as Record<League, string[]>

  for (const league of ['AL', 'NL'] as League[]) {
    const divisionIds = ALL_DIVISION_KEYS.filter((d) => d.startsWith(league))
    const winners: string[] = []
    for (const d of divisionIds) {
      const ids = DIVISIONS[d]
      let best = ids[0]
      for (const id of ids) {
        if (wins[id] > wins[best] || (wins[id] === wins[best] && rng() < 0.5)) best = id
      }
      winners.push(best)
    }
    winners.sort((a, b) => wins[b] - wins[a] || (rng() < 0.5 ? -1 : 1))

    const leagueIds = Object.values(teams).filter((t) => t.league === league).map((t) => t.id)
    const wcCandidates = leagueIds.filter((id) => !winners.includes(id))
    wcCandidates.sort((a, b) => wins[b] - wins[a] || (rng() < 0.5 ? -1 : 1))
    const wildcards = wcCandidates.slice(0, 3)

    divisionWinners[league] = winners
    qualifiers[league] = [...winners, ...wildcards].map((teamId, i) => ({ teamId, seed: i + 1 }))
  }

  const alChamp = runLeaguePostseason('AL', qualifiers.AL, teams, rng)
  const nlChamp = runLeaguePostseason('NL', qualifiers.NL, teams, rng)
  const ws = createWorldSeries(alChamp, nlChamp)
  const champion = simulateSeries(ws, teams, rng)

  return { qualifiers, divisionWinners, pennant: [alChamp.teamId, nlChamp.teamId], champion }
}

// ─── Exportable principal ─────────────────────────────────────────────────────

export function runMonteCarlo(
  teams: Record<string, Team>,
  remainingGames: RemainingGame[],
  currentWins: Record<string, number>,
  config: MCConfig = {},
): MCResult {
  const n   = config.n   ?? 2_000
  const rng = config.rng ?? Math.random

  const cnt = {
    madePlayoffs:   {} as Record<string, number>,
    divisionWinner: {} as Record<string, number>,
    wonPennant:     {} as Record<string, number>,
    champion:       {} as Record<string, number>,
  }
  for (const id of Object.keys(teams)) {
    cnt.madePlayoffs[id] = cnt.divisionWinner[id] = cnt.wonPennant[id] = cnt.champion[id] = 0
  }

  for (let sim = 0; sim < n; sim++) {
    const res = simulateOne(teams, remainingGames, currentWins, rng)

    for (const league of ['AL', 'NL'] as League[]) {
      for (const seed of res.qualifiers[league]) cnt.madePlayoffs[seed.teamId] = (cnt.madePlayoffs[seed.teamId] ?? 0) + 1
      for (const id of res.divisionWinners[league]) cnt.divisionWinner[id] = (cnt.divisionWinner[id] ?? 0) + 1
    }
    for (const id of res.pennant) cnt.wonPennant[id] = (cnt.wonPennant[id] ?? 0) + 1
    cnt.champion[res.champion] = (cnt.champion[res.champion] ?? 0) + 1
  }

  const norm = (obj: Record<string, number>) =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v / n]))

  return {
    n,
    madePlayoffs:   norm(cnt.madePlayoffs),
    divisionWinner: norm(cnt.divisionWinner),
    wonPennant:     norm(cnt.wonPennant),
    champion:       norm(cnt.champion),
  }
}
