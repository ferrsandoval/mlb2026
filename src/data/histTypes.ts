// =============================================================================
// histTypes.ts — Tipos para juegos históricos de MLB (calibración del modelo)
// =============================================================================

export interface HistGame {
  /** Fecha del juego en formato ISO 'YYYY-MM-DD' */
  date: string
  /** ID del seed (p.ej. 'NYY'), resuelto vía teamKey() al parsear el CSV */
  homeId: string
  awayId: string
  homeRuns: number
  awayRuns: number
  /** true = sede neutral (juegos internacionales/series especiales) */
  neutral: boolean
  /** 'Regular Season' | 'Postseason' | 'Spring Training' … */
  comp: string
}

export type GameResult = 'H' | 'A'

/** Resultado del juego desde la perspectiva del equipo local. Sin empates. */
export function gameOutcome(m: Pick<HistGame, 'homeRuns' | 'awayRuns'>): GameResult {
  return m.homeRuns > m.awayRuns ? 'H' : 'A'
}
