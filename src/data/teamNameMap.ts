// =============================================================================
// teamNameMap.ts — Traduce códigos de equipo de fuentes externas a los IDs del seed
// -----------------------------------------------------------------------------
// Retrosheet (fuente recomendada para historial, ver HISTORY_DATA.md) usa sus
// propios códigos de 3 letras para algunos equipos que difieren de los códigos
// modernos de MLB.com usados en seed.ts. Este mapa traduce entre ambos.
// =============================================================================

/** Código Retrosheet -> ID del seed (solo se listan los que DIFIEREN). */
export const RETROSHEET_TO_ID: Record<string, string> = {
  CHA: 'CWS',  // Chicago White Sox
  CHN: 'CHC',  // Chicago Cubs
  KCA: 'KC',   // Kansas City Royals
  LAN: 'LAD',  // Los Angeles Dodgers
  NYA: 'NYY',  // New York Yankees
  NYN: 'NYM',  // New York Mets
  SDN: 'SD',   // San Diego Padres
  SFN: 'SF',   // San Francisco Giants
  SLN: 'STL',  // St. Louis Cardinals
  TBA: 'TB',   // Tampa Bay Rays
  WAS: 'WSH',  // Washington Nationals
  ANA: 'LAA',  // Los Angeles Angels (también "LAA" en años recientes)
  OAK: 'ATH',  // Athletics (Oakland, códigos históricos)
  ATH: 'ATH',  // Athletics (Sacramento, 2025+)
}

/** Traduce un código externo al ID del seed; si no está en el mapa, se asume igual. */
export const teamKey = (code: string): string => RETROSHEET_TO_ID[code] ?? code
