// =============================================================================
// logos.ts — Logos oficiales de MLB por equipo (indexados por id de la semilla).
// -----------------------------------------------------------------------------
// Fuente: CDN oficial de MLB (www.mlbstatic.com/team-logos/{mlbamId}.svg). Son
// SVG con encuadre uniforme, cuadrado y centrado — a diferencia de las imágenes
// sueltas anteriores (imgur/freebiesupply), que venían con recortes y márgenes
// dispares y salían descentradas o apretadas en el badge.
//
// La clave es el id de la semilla (seed.ts); el valor usa el id numérico de la
// MLB Stats API (MLBAM). TeamBadge cae al código del equipo si el SVG no carga.
// =============================================================================

const MLBAM_ID: Record<string, number> = {
  // AL East
  NYY: 147, BOS: 111, TOR: 141, BAL: 110, TB: 139,
  // AL Central
  CLE: 114, MIN: 142, DET: 116, CWS: 145, KC: 118,
  // AL West
  HOU: 117, SEA: 136, TEX: 140, LAA: 108, ATH: 133,
  // NL East
  ATL: 144, NYM: 121, PHI: 143, MIA: 146, WSH: 120,
  // NL Central
  MIL: 158, CHC: 112, CIN: 113, PIT: 134, STL: 138,
  // NL West
  LAD: 119, SD: 135, SF: 137, ARI: 109, COL: 115,
}

export const LOGOS: Record<string, string> = Object.fromEntries(
  Object.entries(MLBAM_ID).map(([id, mlbam]) => [id, `https://www.mlbstatic.com/team-logos/${mlbam}.svg`]),
)
