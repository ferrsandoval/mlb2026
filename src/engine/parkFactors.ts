// =============================================================================
// parkFactors.ts — Factores de parque (run environment por estadio)
// -----------------------------------------------------------------------------
// El entorno de carreras varía muchísimo por estadio: Coors Field (altitud de
// Denver) infla ~13% las carreras; Oracle Park (SF), T-Mobile (SEA) y Petco (SD)
// las deprimen ~6-8%. El factor multiplica las carreras esperadas de AMBOS
// equipos en ese estadio, así que afecta sobre todo el total (over/under) y el
// marcador exacto, y muy poco el ganador (es simétrico).
//
// Valores: factor de carreras multianual aproximado, 1.00 = neutral. Son
// estimaciones estables (no cambian temporada a temporada de forma brusca);
// cualquier estadio no listado usa 1.00. Se pueden refinar más adelante.
// =============================================================================

export const PARK_FACTORS: Record<string, number> = {
  COL: 1.13, // Coors Field — altitud, el parque más ofensivo por lejos
  CIN: 1.05, // Great American Ball Park
  BOS: 1.05, // Fenway Park
  ARI: 1.04, // Chase Field
  KC:  1.02, // Kauffman Stadium
  TOR: 1.02, // Rogers Centre
  CWS: 1.01, // Rate Field
  PHI: 1.01, // Citizens Bank Park
  BAL: 1.01, // Camden Yards
  TEX: 1.01, // Globe Life Field
  NYY: 1.01, // Yankee Stadium (jonronero por la banda corta)
  CHC: 1.01, // Wrigley Field (muy dependiente del viento)
  WSH: 1.01, // Nationals Park
  HOU: 1.00, // Daikin Park
  ATL: 1.00, // Truist Park
  MIN: 1.00, // Target Field
  LAA: 1.00, // Angel Stadium
  MIL: 1.00, // American Family Field
  ATH: 1.00, // Sutter Health Park (Sacramento) — sin histórico fiable, neutral
  TB:  1.00, // Steinbrenner Field 2026 — sin histórico, neutral
  PIT: 0.99, // PNC Park
  DET: 0.98, // Comerica Park
  STL: 0.98, // Busch Stadium
  CLE: 0.98, // Progressive Field
  LAD: 0.98, // Dodger Stadium
  MIA: 0.97, // loanDepot Park
  NYM: 0.97, // Citi Field
  SD:  0.95, // Petco Park
  SEA: 0.94, // T-Mobile Park
  SF:  0.92, // Oracle Park — el más pitcher-friendly
}

/** Factor de carreras del estadio del equipo LOCAL (1.0 si se desconoce). */
export function parkFactor(homeTeamId: string): number {
  return PARK_FACTORS[homeTeamId] ?? 1.0
}
