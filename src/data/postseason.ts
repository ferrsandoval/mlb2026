// =============================================================================
// postseason.ts — Formato de Postemporada MLB (desde 2022): 6 equipos por liga
// -----------------------------------------------------------------------------
//   Seeds 1-3: campeones de división (por récord)
//   Seeds 4-6: comodines (Wild Card)
//   Wild Card Series   (mejor de 3): 3 vs 6, 4 vs 5 — todo en casa del seed alto
//   Serie Divisional   (mejor de 5): reseeding, 1 vs peor sobreviviente
//   Serie de Campeonato (mejor de 7)
//   Serie Mundial       (mejor de 7): ventaja de local para el mejor récord
//
// A diferencia del bracket fijo del Mundial, aquí el emparejamiento depende
// enteramente de las posiciones finales — se construye en runtime, no hay
// una llave "INITIAL_" precableada.
// =============================================================================

import type { League } from './seed'

export type PostseasonRound = 'WC' | 'LDS' | 'LCS' | 'WS'

export const ROUND_LABELS: Record<PostseasonRound, string> = {
  WC:  'Serie de Comodín',
  LDS: 'Serie Divisional',
  LCS: 'Serie de Campeonato',
  WS:  'Serie Mundial',
}

export interface SeriesGame {
  gameNum: number
  homeId: string
  awayId: string
  homeRuns: number | null
  awayRuns: number | null
}

export interface Series {
  id: string
  round: PostseasonRound
  league: League | null   // null = Serie Mundial (cruza ligas)
  bestOf: 3 | 5 | 7
  higherSeedId: string
  lowerSeedId: string
  higherSeedNum: number
  lowerSeedNum: number
  games: SeriesGame[]
  winnerId: string | null
}

// Patrón de sede por juego: 'higher' = casa del seed más alto (número más bajo)
const HOME_PATTERN: Record<3 | 5 | 7, ('higher' | 'lower')[]> = {
  3: ['higher', 'higher', 'higher'],
  5: ['higher', 'higher', 'lower', 'lower', 'higher'],
  7: ['higher', 'higher', 'lower', 'lower', 'lower', 'higher', 'higher'],
}

export function gamesToWin(bestOf: 3 | 5 | 7): number {
  return Math.ceil(bestOf / 2)
}

export function createSeries(
  id: string,
  round: PostseasonRound,
  league: League | null,
  bestOf: 3 | 5 | 7,
  higherSeedId: string,
  higherSeedNum: number,
  lowerSeedId: string,
  lowerSeedNum: number,
): Series {
  const pattern = HOME_PATTERN[bestOf]
  const games: SeriesGame[] = pattern.map((side, i) => ({
    gameNum: i + 1,
    homeId: side === 'higher' ? higherSeedId : lowerSeedId,
    awayId: side === 'higher' ? lowerSeedId : higherSeedId,
    homeRuns: null,
    awayRuns: null,
  }))
  return { id, round, league, bestOf, higherSeedId, lowerSeedId, higherSeedNum, lowerSeedNum, games, winnerId: null }
}

/** Recalcula el ganador de una serie a partir de los juegos jugados. */
export function seriesWinner(series: Pick<Series, 'games' | 'bestOf' | 'higherSeedId' | 'lowerSeedId'>): string | null {
  const need = gamesToWin(series.bestOf)
  let higherWins = 0, lowerWins = 0
  for (const g of series.games) {
    if (g.homeRuns == null || g.awayRuns == null) continue
    const homeIsHigher = g.homeId === series.higherSeedId
    if (g.homeRuns > g.awayRuns) { if (homeIsHigher) higherWins++; else lowerWins++ }
    else { if (homeIsHigher) lowerWins++; else higherWins++ }
  }
  if (higherWins >= need) return series.higherSeedId
  if (lowerWins >= need) return series.lowerSeedId
  return null
}

export interface SeedEntry { teamId: string; seed: number }

/** Wild Card Round: seed 3 vs 6, seed 4 vs 5. Seeds 1-2 avanzan directo (bye). */
export function createWildCardRound(league: League, seeds: SeedEntry[]): Series[] {
  const bySeed = Object.fromEntries(seeds.map((s) => [s.seed, s.teamId]))
  return [
    createSeries(`${league}-WC-1`, 'WC', league, 3, bySeed[3], 3, bySeed[6], 6),
    createSeries(`${league}-WC-2`, 'WC', league, 3, bySeed[4], 4, bySeed[5], 5),
  ]
}

/**
 * Serie Divisional con reseeding: el seed 1 enfrenta al sobreviviente de
 * menor seed (más débil), el seed 2 enfrenta al otro sobreviviente.
 */
export function createDivisionSeries(
  league: League,
  seeds: SeedEntry[],
  wcWinners: { teamId: string; seed: number }[],
): Series[] {
  const bySeed = Object.fromEntries(seeds.map((s) => [s.seed, s.teamId]))
  const survivors = [...wcWinners].sort((a, b) => a.seed - b.seed) // menor seed = mejor
  const weakest = survivors[survivors.length - 1]
  const other   = survivors[0]
  return [
    createSeries(`${league}-LDS-1`, 'LDS', league, 5, bySeed[1], 1, weakest.teamId, weakest.seed),
    createSeries(`${league}-LDS-2`, 'LDS', league, 5, bySeed[2], 2, other.teamId, other.seed),
  ]
}

export function createLeagueChampionship(
  league: League,
  ldsWinners: { teamId: string; seed: number }[],
): Series {
  const [a, b] = [...ldsWinners].sort((x, y) => x.seed - y.seed)
  return createSeries(`${league}-LCS`, 'LCS', league, 7, a.teamId, a.seed, b.teamId, b.seed)
}

/**
 * Serie Mundial: ventaja de local para el finalista con mejor seed de su liga
 * (simplificación — en la realidad se compara récord real cruzando ligas).
 */
export function createWorldSeries(
  alChampion: { teamId: string; seed: number },
  nlChampion: { teamId: string; seed: number },
): Series {
  const [higher, lower] = alChampion.seed <= nlChampion.seed
    ? [alChampion, nlChampion]
    : [nlChampion, alChampion]
  return createSeries('WS', 'WS', null, 7, higher.teamId, higher.seed, lower.teamId, lower.seed)
}
