// =============================================================================
// pitchers.ts — Rating del lanzador abridor y su efecto en las carreras esperadas
// -----------------------------------------------------------------------------
// El abridor es EL factor más determinante de un juego individual de MLB — mucho
// más que en fútbol. Un mismo equipo con su as o con su 5º abridor es casi otro
// equipo. El rating de equipo (Elo/ataque/defensa) no lo ve; este módulo lo añade.
//
// Rating usado: FIP (Fielding Independent Pitching) en vez de ERA. FIP aísla lo
// que el lanzador controla (ponches, bases por bolas, jonrones), ignora la
// defensa y la suerte en pelotas en juego, y por eso predice el desempeño FUTURO
// mejor que ERA. Está en escala de ERA (carreras por 9 innings).
//   FIP = (13·HR + 3·BB − 2·SO) / IP + constante
//
// El FIP se regresa a la media de liga según los innings lanzados (poca muestra
// → cerca del promedio) y se convierte en un factor multiplicativo de supresión
// de carreras del equipo RIVAL, diluido porque el abridor solo cubre ~60% del
// juego (el resto lo lanza el bullpen, que aproximamos como liga promedio).
// =============================================================================

import type { Game } from '../data/seed'
import type { MatchupContext } from './poisson'
import { parkFactor } from './parkFactors'

export interface PitcherStats {
  id: number
  name: string
  ip: number  // innings lanzados (decimal real, ya convertido de la notación .1/.2)
  hr: number
  bb: number
  so: number
  era?: number
}

export interface PitcherRating {
  id: string
  name: string
  fip: number      // FIP regresado a la media de liga
  ip: number
  fipRatio: number // FIP regresado / FIP de liga (1 = promedio; componente puro del abridor)
  factor: number   // factor de supresión asumiendo bullpen promedio (para mostrar) [0.75, 1.25]
}

export const LEAGUE_FIP = 4.15          // FIP/ERA promedio de liga (escala de carreras/9)
export const FIP_CONSTANT = 3.10        // constante que alinea FIP con ERA de liga
export const STARTER_GAME_SHARE = 0.6   // fracción del juego que cubre el abridor
export const FIP_PRIOR_IP = 40          // innings de prior (fuerza de la regresión a la media)
export const FACTOR_MIN = 0.75
export const FACTOR_MAX = 1.25

/**
 * Convierte la notación de innings de MLB ("95.1" = 95 y 1 out = 95⅓) a innings
 * decimales reales. Acepta number o string.
 */
export function parseInningsPitched(ip: number | string): number {
  const s = String(ip)
  const [wholeStr, fracStr] = s.split('.')
  const whole = parseInt(wholeStr, 10) || 0
  const outs = fracStr ? parseInt(fracStr[0], 10) || 0 : 0
  return whole + Math.min(2, outs) / 3
}

/** FIP crudo. Con IP = 0 devuelve la media de liga. */
export function computeFIP(s: Pick<PitcherStats, 'ip' | 'hr' | 'bb' | 'so'>): number {
  if (s.ip <= 0) return LEAGUE_FIP
  return (13 * s.hr + 3 * s.bb - 2 * s.so) / s.ip + FIP_CONSTANT
}

/** FIP regresado a la media de liga según los innings lanzados. */
export function regressedFIP(rawFip: number, ip: number): number {
  return (rawFip * ip + LEAGUE_FIP * FIP_PRIOR_IP) / (ip + FIP_PRIOR_IP)
}

/**
 * Factor de supresión de carreras del abridor sobre el equipo RIVAL.
 * factor < 1 → el rival anota menos de lo normal; > 1 → anota más.
 */
export function pitcherFactor(rawFip: number, ip: number): number {
  const rf = regressedFIP(rawFip, ip)
  const raw = rf / LEAGUE_FIP
  const blended = STARTER_GAME_SHARE * raw + (1 - STARTER_GAME_SHARE) * 1
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, blended))
}

export function buildPitcherRating(s: PitcherStats): PitcherRating {
  const rawFip = computeFIP(s)
  return {
    id: String(s.id),
    name: s.name,
    fip: regressedFIP(rawFip, s.ip),
    ip: s.ip,
    fipRatio: regressedFIP(rawFip, s.ip) / LEAGUE_FIP,
    factor: pitcherFactor(rawFip, s.ip),
  }
}

/**
 * Supresión de carreras de un lado combinando abridor (~60% del juego) y bullpen
 * (~40%). `starterRatio` y `bullpenFactor` son "carreras permitidas relativas a la
 * liga" (1 = promedio, <1 = suprime). Si no se conoce el abridor, se usa 1
 * (neutral) para su porción, dejando que el bullpen ajuste el resto.
 */
export function combineSuppression(starterRatio: number | undefined, bullpenFactor = 1): number {
  const starter = starterRatio ?? 1
  const f = STARTER_GAME_SHARE * starter + (1 - STARTER_GAME_SHARE) * bullpenFactor
  return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, f))
}

/**
 * Construye el contexto de enfrentamiento por juego: supresión de cada lado
 * (abridor + bullpen) y factor de parque. `bullpens` mapea teamId → factor
 * relativo a la liga (1 = promedio). Solo omite un juego si no hay ningún dato
 * que aporte (sin abridores, sin bullpen y parque neutral).
 */
export function buildMatchupContext(
  games: Game[],
  ratings: Record<string, PitcherRating>,
  bullpens: Record<string, number> = {},
): Record<string, MatchupContext> {
  const ctx: Record<string, MatchupContext> = {}
  for (const g of games) {
    const homeStarter = g.homePitcherId ? ratings[g.homePitcherId]?.fipRatio : undefined
    const awayStarter = g.awayPitcherId ? ratings[g.awayPitcherId]?.fipRatio : undefined
    const homeBull = bullpens[g.homeId]
    const awayBull = bullpens[g.awayId]
    const park = parkFactor(g.homeId)

    const hasPitching = homeStarter !== undefined || awayStarter !== undefined || homeBull !== undefined || awayBull !== undefined
    if (!hasPitching && park === 1) continue

    ctx[g.id] = {
      homePitcherFactor: combineSuppression(homeStarter, homeBull ?? 1), // pitcheo local → frena visitante
      awayPitcherFactor: combineSuppression(awayStarter, awayBull ?? 1), // pitcheo visitante → frena local
      parkFactor: park,
    }
  }
  return ctx
}
