// =============================================================================
// standings.ts — Tabla de posiciones por división + carrera de comodín (Wild Card)
// =============================================================================

import type { Game, Team, League, DivisionKey } from '../data/seed'
import { DIVISIONS } from '../data/seed'
import type { GamePrediction } from '../types'
import { pythagenpatWinPct } from './winprob'

export interface TeamStanding {
  team: Team
  // Real
  wins: number
  losses: number
  runsFor: number
  runsAgainst: number
  played: number
  // Proyectado (matriz Binomial Negativa) sobre juegos pendientes
  xWins: number
  xRunsFor: number
  xRunsAgainst: number
  // Combinado: real + proyección de pendientes
  projWins: number
  projWinPct: number
  runDiff: number
  // Pythagenpat: % de victorias "merecido" según el diferencial de carreras
  // REAL acumulado. Suele anticipar el récord futuro mejor que el récord actual
  // (descuenta la suerte en juegos de una carrera). null hasta que haya juegos.
  pythWinPct: number | null
  pythProjWins: number
}

function emptyStanding(team: Team): TeamStanding {
  return {
    team, wins: 0, losses: 0, runsFor: 0, runsAgainst: 0, played: 0,
    xWins: 0, xRunsFor: 0, xRunsAgainst: 0, projWins: 0, projWinPct: 0, runDiff: 0,
    pythWinPct: null, pythProjWins: 0,
  }
}

function accumulate(
  standings: Record<string, TeamStanding>,
  games: Game[],
  predictions: Record<string, GamePrediction>,
) {
  for (const g of games) {
    const home = standings[g.homeId]
    const away = standings[g.awayId]
    if (!home || !away) continue
    const pred = predictions[g.id]

    if (g.played && g.homeRuns != null && g.awayRuns != null) {
      home.played++; away.played++
      home.runsFor += g.homeRuns; home.runsAgainst += g.awayRuns
      away.runsFor += g.awayRuns; away.runsAgainst += g.homeRuns
      if (g.homeRuns > g.awayRuns) { home.wins++; away.losses++ }
      else { away.wins++; home.losses++ }
    } else if (pred) {
      home.xWins += pred.probHome
      away.xWins += pred.probAway
      home.xRunsFor += pred.lambdaHome; home.xRunsAgainst += pred.lambdaAway
      away.xRunsFor += pred.lambdaAway; away.xRunsAgainst += pred.lambdaHome
    }
  }
}

function finalize(standings: Record<string, TeamStanding>, teamIds: string[]) {
  for (const id of teamIds) {
    const s = standings[id]
    s.runDiff = (s.runsFor + s.xRunsFor) - (s.runsAgainst + s.xRunsAgainst)
    s.projWins = s.wins + s.xWins
    s.projWinPct = s.projWins / 162
    // Pythagenpat sobre el diferencial de carreras REAL (solo juegos jugados).
    if (s.played > 0) {
      s.pythWinPct = pythagenpatWinPct(s.runsFor, s.runsAgainst, s.played)
      // Proyección "merecida": ritmo Pythagenpat aplicado a lo jugado + modelo en lo pendiente.
      s.pythProjWins = s.pythWinPct * s.played + s.xWins
    }
  }
}

function sortStandings(list: TeamStanding[]): TeamStanding[] {
  return [...list].sort((a, b) => b.projWins - a.projWins || b.runDiff - a.runDiff)
}

export function computeDivisionStandings(
  division: DivisionKey,
  games: Game[],
  teams: Record<string, Team>,
  predictions: Record<string, GamePrediction>,
): TeamStanding[] {
  const teamIds = DIVISIONS[division] ?? []
  const standings: Record<string, TeamStanding> = {}
  for (const id of teamIds) standings[id] = emptyStanding(teams[id])

  const relevant = games.filter((g) => teamIds.includes(g.homeId) && teamIds.includes(g.awayId))
  accumulate(standings, relevant, predictions)
  finalize(standings, teamIds)
  return sortStandings(Object.values(standings))
}

/** Standings de TODOS los equipos de una liga, para calcular comodines. */
export function computeLeagueStandings(
  league: League,
  games: Game[],
  teams: Record<string, Team>,
  predictions: Record<string, GamePrediction>,
): TeamStanding[] {
  const teamIds = Object.values(teams).filter((t) => t.league === league).map((t) => t.id)
  const standings: Record<string, TeamStanding> = {}
  for (const id of teamIds) standings[id] = emptyStanding(teams[id])

  const relevant = games.filter((g) => teamIds.includes(g.homeId) && teamIds.includes(g.awayId))
  accumulate(standings, relevant, predictions)
  finalize(standings, teamIds)
  return sortStandings(Object.values(standings))
}

export interface WildCardStanding extends TeamStanding {
  gamesBackWC: number
}

/**
 * Top 3 comodines de una liga: todos los equipos que NO ganaron su división,
 * ordenados por wins proyectados. Los primeros 3 clasifican a la Postemporada.
 */
export function computeWildCardStandings(
  leagueStandings: TeamStanding[],
  divisionWinnerIds: Set<string>,
): WildCardStanding[] {
  const contenders = leagueStandings.filter((s) => !divisionWinnerIds.has(s.team.id))
  const sorted = sortStandings(contenders)
  const thirdWCWins = sorted[2]?.projWins ?? 0
  return sorted.map((s) => ({ ...s, gamesBackWC: Math.max(0, thirdWCWins - s.projWins) }))
}

/** Devuelve el ganador de cada división de una liga (primer lugar de cada tabla). */
export function computeDivisionWinners(
  league: League,
  games: Game[],
  teams: Record<string, Team>,
  predictions: Record<string, GamePrediction>,
): TeamStanding[] {
  const divisions = (Object.keys(DIVISIONS) as DivisionKey[]).filter((d) => d.startsWith(league))
  return divisions.map((d) => computeDivisionStandings(d, games, teams, predictions)[0])
}
