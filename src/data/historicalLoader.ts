// =============================================================================
// historicalLoader.ts — Carga y parsea el historial de juegos desde CSV
// =============================================================================
// Fuente esperada: /public/history.csv (ver HISTORY_DATA.md para el formato).
// Si el archivo no existe o la red falla, devuelve [] sin lanzar excepción;
// el motor sigue funcionando en modo degradado (ratings del seed únicamente).
// =============================================================================

import { teamKey } from './teamNameMap'
import type { HistGame } from './histTypes'

/**
 * Parsea el texto completo del CSV y devuelve los juegos ordenados por fecha.
 * Formato de columnas (sin comillas, separador coma):
 *   date, home, away, home_runs, away_runs, neutral, comp
 */
export function parseHistoryCsv(text: string): HistGame[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const lines = clean.trim().split('\n')
  if (lines.length < 2) return []

  const games: HistGame[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const parts = line.split(',')
    if (parts.length < 6) continue

    const date      = parts[0].trim()
    const home      = parts[1].trim()
    const away      = parts[2].trim()
    const homeRuns  = parseInt(parts[3].trim(), 10)
    const awayRuns  = parseInt(parts[4].trim(), 10)
    const neutral   = parts[5].trim().toLowerCase() === 'true'
    const comp      = parts.slice(6).join(',').trim()

    if (!date || !home || !away) continue
    if (isNaN(homeRuns) || isNaN(awayRuns)) continue
    if (homeRuns < 0 || awayRuns < 0) continue

    games.push({
      date,
      homeId: teamKey(home),
      awayId: teamKey(away),
      homeRuns,
      awayRuns,
      neutral,
      comp,
    })
  }

  games.sort((a, b) => a.date.localeCompare(b.date))
  return games
}

export async function loadHistoricalGames(): Promise<HistGame[]> {
  try {
    const res = await fetch('/history.csv')
    if (!res.ok) return []
    const text = await res.text()
    return parseHistoryCsv(text)
  } catch {
    return []
  }
}
