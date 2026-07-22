// =============================================================================
// personalPicks.ts — Predicciones personales de marcador y evaluación del modelo
// =============================================================================

import { poissonPmf } from './poisson'

export interface PersonalPick {
  homeRuns: number
  awayRuns: number
}

/** Resultado moneyline implícito en el marcador predicho (sin empates). */
export function pickOutcome(pick: PersonalPick): 'home' | 'away' {
  return pick.homeRuns >= pick.awayRuns ? 'home' : 'away'
}

/** P(marcador exacto) usando Poisson independiente. */
export function pExactScore(homeRuns: number, awayRuns: number, lambdaHome: number, lambdaAway: number): number {
  return poissonPmf(lambdaHome, homeRuns) * poissonPmf(lambdaAway, awayRuns)
}

/** P(resultado correcto) según el marcador predicho. */
export function pCorrectOutcome(pick: PersonalPick, probHome: number, probAway: number): number {
  return pickOutcome(pick) === 'home' ? probHome : probAway
}

export function exportPicksCsv(picks: Record<string, PersonalPick>): string {
  const rows = Object.entries(picks)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([gameId, p]) => `${gameId},${p.homeRuns},${p.awayRuns}`)
  return ['gameId,homeRuns,awayRuns', ...rows].join('\n')
}

/**
 * Parsea CSV de predicciones personales.
 * Formato: gameId,homeRuns,awayRuns
 */
export function parsePicksCsv(text: string): Record<string, PersonalPick> {
  const result: Record<string, PersonalPick> = {}
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = clean.trim().split('\n')
  if (lines.length < 2) return result

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(',')
    if (parts.length < 3) continue
    const gameId   = parts[0].trim()
    const homeRuns = parseInt(parts[1].trim(), 10)
    const awayRuns = parseInt(parts[2].trim(), 10)
    if (!gameId || isNaN(homeRuns) || isNaN(awayRuns)) continue
    if (homeRuns < 0 || awayRuns < 0 || homeRuns > 30 || awayRuns > 30) continue
    result[gameId] = { homeRuns, awayRuns }
  }
  return result
}
