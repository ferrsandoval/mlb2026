// =============================================================================
// elo.ts — Expectativa Elo y actualización post-juego (estilo 538 MLB Elo)
// -----------------------------------------------------------------------------
// K más bajo que en un torneo de eliminación directa: con 162 juegos por
// temporada, cada resultado individual debe mover poco el rating.
// =============================================================================

import type { Team } from '../data/seed'

const K_MLB = 4          // factor K — pequeño porque hay muchos juegos/temporada
const HOME_ADV_ELO = 24  // ventaja de localía en puntos Elo (todo equipo es local en casa)

// ─── Expectativa ─────────────────────────────────────────────────────────────

export function eloWinExpectancy(eloA: number, eloB: number, homeBonus = 0): number {
  return 1 / (1 + Math.pow(10, -((eloA + homeBonus) - eloB) / 400))
}

// ─── Factor de margen de carreras ─────────────────────────────────────────────

/** Multiplicador según diferencia de carreras (análogo al de margen de goles). */
export function runMarginFactor(runDiff: number): number {
  const m = Math.abs(runDiff)
  return Math.log(m + 1) + 1
}

// ─── Resultado numérico ───────────────────────────────────────────────────────

/** 1 = gana local, 0 = gana visitante. El béisbol no tiene empates. */
export function gameResult(homeRuns: number, awayRuns: number): number {
  return homeRuns > awayRuns ? 1 : 0
}

// ─── Actualización ───────────────────────────────────────────────────────────

export interface EloUpdate {
  newEloHome: number
  newEloAway: number
  deltaHome: number
}

export function updateElo(
  homeTeam: Pick<Team, 'elo'>,
  awayTeam: Pick<Team, 'elo'>,
  homeRuns: number,
  awayRuns: number,
): EloUpdate {
  const We = eloWinExpectancy(homeTeam.elo, awayTeam.elo, HOME_ADV_ELO)
  const W = gameResult(homeRuns, awayRuns)
  const G = runMarginFactor(homeRuns - awayRuns)

  const delta = K_MLB * G * (W - We)

  return {
    newEloHome: Math.round(homeTeam.elo + delta),
    newEloAway: Math.round(awayTeam.elo - delta),
    deltaHome: delta,
  }
}
