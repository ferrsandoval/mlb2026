// =============================================================================
// mlbStatsApi.ts — Sincronización con la MLB Stats API (pública, sin API key)
// -----------------------------------------------------------------------------
//   https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=...&endDate=...
//
// A diferencia del calendario sintético (scheduleGenerator.ts), esta es la
// fuente AUTORITATIVA: calendario real, marcadores en vivo y resultados
// finales. "Sincronizar calendario" reemplaza los juegos sintéticos por los
// reales (con sus gamePk oficiales como ID); "Sincronizar resultados" solo
// actualiza marcadores de juegos ya existentes en el store.
// =============================================================================

import type { Game, Team } from '../data/seed'
import { buildPitcherRating, parseInningsPitched, computeFIP, regressedFIP } from './pitchers'
import type { PitcherRating } from './pitchers'

const STATS_API = 'https://statsapi.mlb.com/api/v1/schedule'
const PEOPLE_API = 'https://statsapi.mlb.com/api/v1/people'
const TEAM_STATS_API = 'https://statsapi.mlb.com/api/v1/teams/stats'

interface RawPitcher {
  id: number
  fullName: string
}

interface RawTeam {
  team: { id: number; name: string }
  score?: number
  isWinner?: boolean
  probablePitcher?: RawPitcher
}

interface RawGame {
  gamePk: number
  status: { statusCode: string; detailedState: string }
  teams: { home: RawTeam; away: RawTeam }
  venue?: { name: string }
}

interface RawDate {
  date: string
  games: RawGame[]
}

interface RawSchedule {
  dates: RawDate[]
}

export interface MlbGameEvent {
  gamePk: number
  date: string
  homeName: string
  awayName: string
  homeRuns: number | null
  awayRuns: number | null
  completed: boolean
  status: string
  homePitcherId: string | null
  awayPitcherId: string | null
}

function parseEvents(raw: RawSchedule): MlbGameEvent[] {
  const events: MlbGameEvent[] = []
  for (const d of raw.dates ?? []) {
    for (const g of d.games ?? []) {
      const completed = g.status?.statusCode === 'F' || g.status?.statusCode === 'O'
      events.push({
        gamePk: g.gamePk,
        date: d.date,
        homeName: g.teams.home.team.name,
        awayName: g.teams.away.team.name,
        homeRuns: g.teams.home.score ?? null,
        awayRuns: g.teams.away.score ?? null,
        completed,
        status: g.status?.detailedState ?? '',
        homePitcherId: g.teams.home.probablePitcher ? String(g.teams.home.probablePitcher.id) : null,
        awayPitcherId: g.teams.away.probablePitcher ? String(g.teams.away.probablePitcher.id) : null,
      })
    }
  }
  return events
}

export async function fetchMlbSchedule(startDate: string, endDate: string, season: number): Promise<MlbGameEvent[]> {
  const url = `${STATS_API}?sportId=1&season=${season}&startDate=${startDate}&endDate=${endDate}&hydrate=probablePitcher`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MLB Stats API ${res.status}`)
  const raw = (await res.json()) as RawSchedule
  return parseEvents(raw)
}

// ─── Ratings de abridores (endpoint people, en lote) ──────────────────────────

interface RawPeople {
  people?: Array<{
    id: number
    fullName: string
    stats?: Array<{ splits?: Array<{ stat: Record<string, unknown> }> }>
  }>
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

/**
 * Trae en UNA sola llamada el rating FIP de varios abridores (endpoint people con
 * hydrate de stats de temporada). Devuelve un mapa id→PitcherRating; los ids sin
 * estadísticas de pitcheo se omiten (el motor los tratará como neutrales).
 */
export async function fetchPitcherRatings(
  pitcherIds: string[],
  season: number,
): Promise<Record<string, PitcherRating>> {
  const ids = [...new Set(pitcherIds.filter(Boolean))]
  if (ids.length === 0) return {}

  const ratings: Record<string, PitcherRating> = {}
  // El endpoint acepta muchos ids; se trocea por seguridad ante URLs muy largas.
  const CHUNK = 50
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK)
    const hydrate = `stats(group=[pitching],type=[season],season=${season})`
    const url = `${PEOPLE_API}?personIds=${chunk.join(',')}&hydrate=${encodeURIComponent(hydrate)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`MLB Stats API people ${res.status}`)
    const raw = (await res.json()) as RawPeople

    for (const p of raw.people ?? []) {
      const split = p.stats?.[0]?.splits?.[0]?.stat
      if (!split) continue // sin stats de temporada (aún no lanza / temporada nueva)
      ratings[String(p.id)] = buildPitcherRating({
        id: p.id,
        name: p.fullName,
        ip: parseInningsPitched((split.inningsPitched as string | number) ?? 0),
        hr: num(split.homeRuns),
        bb: num(split.baseOnBalls),
        so: num(split.strikeOuts),
        era: num(split.era),
      })
    }
  }
  return ratings
}

/** Mapa nombre completo MLB -> ID del seed (construido desde seed.ts, mismos nombres oficiales). */
export function buildNameToId(teams: Team[]): Record<string, string> {
  return Object.fromEntries(teams.map((t) => [t.name, t.id]))
}

/** Convierte eventos de la API en Game[] del store — reemplaza el calendario sintético. */
export function buildGamesFromEvents(events: MlbGameEvent[], nameToId: Record<string, string>): {
  games: Game[]
  unmatched: string[]
} {
  const games: Game[] = []
  const unmatched: string[] = []

  for (const ev of events) {
    const homeId = nameToId[ev.homeName]
    const awayId = nameToId[ev.awayName]
    if (!homeId || !awayId) {
      unmatched.push(`${ev.awayName} @ ${ev.homeName}`)
      continue
    }
    games.push({
      id: `MLB${ev.gamePk}`,
      date: ev.date,
      homeId,
      awayId,
      stage: 'regular',
      played: ev.completed && ev.homeRuns != null && ev.awayRuns != null,
      homeRuns: ev.homeRuns ?? undefined,
      awayRuns: ev.awayRuns ?? undefined,
      homePitcherId: ev.homePitcherId ?? undefined,
      awayPitcherId: ev.awayPitcherId ?? undefined,
    })
  }

  return { games, unmatched }
}

export interface ScoreSyncResult {
  updated: number
  unmatched: string[]
  errors: string[]
}

// ─── Líneas de apuestas por juego (total + moneyline) — API pública de ESPN ────
// La MLB Stats API no publica líneas de apuestas; ESPN sí (sin API key, CORS
// abierto, momios de DraftKings). Se publican ~1 día antes. El total varía por
// juego (7.5, 8, 8.5, 9…); el moneyline es el momio americano real de cada lado.
// Clave del mapa: `${date}|${awayId}|${homeId}`.

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard'

// Abreviaturas ESPN → id del seed (idénticas salvo los White Sox: CHW→CWS).
const ESPN_ABBR_TO_ID: Record<string, string> = { CHW: 'CWS' }
const espnId = (abbr: string): string => ESPN_ABBR_TO_ID[abbr] ?? abbr

/** Momio americano ("-294"/"+234") → número; undefined si no es válido. */
const parseAmerican = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && n !== 0 ? n : undefined
}

interface EspnSide { close?: { odds?: string } }
interface EspnScoreboard {
  events?: Array<{
    competitions?: Array<{
      odds?: Array<{ overUnder?: number; moneyline?: { home?: EspnSide; away?: EspnSide } }>
      competitors?: Array<{ homeAway?: string; team?: { abbreviation?: string } }>
    }>
  }>
}

export interface MarketLine {
  total?: number   // línea over/under
  mlHome?: number  // moneyline americano real del local
  mlAway?: number  // moneyline americano real del visitante
}

/** Trae total + moneyline real por juego para las fechas dadas. */
export async function fetchMarketLines(dates: string[]): Promise<Record<string, MarketLine>> {
  const lines: Record<string, MarketLine> = {}
  for (const date of [...new Set(dates)]) {
    try {
      const ymd = date.replace(/-/g, '')
      const res = await fetch(`${ESPN_SCOREBOARD}?dates=${ymd}`)
      if (!res.ok) continue
      const data = (await res.json()) as EspnScoreboard
      for (const ev of data.events ?? []) {
        const comp = ev.competitions?.[0]
        const o = comp?.odds?.[0]
        if (comp == null || o == null) continue
        const home = comp.competitors?.find((c) => c.homeAway === 'home')?.team?.abbreviation
        const away = comp.competitors?.find((c) => c.homeAway === 'away')?.team?.abbreviation
        if (!home || !away) continue
        const line: MarketLine = {
          total: o.overUnder != null ? Number(o.overUnder) : undefined,
          mlHome: parseAmerican(o.moneyline?.home?.close?.odds),
          mlAway: parseAmerican(o.moneyline?.away?.close?.odds),
        }
        if (line.total != null || line.mlHome != null || line.mlAway != null) {
          lines[`${date}|${espnId(away)}|${espnId(home)}`] = line
        }
      }
    } catch { /* ignora fechas que fallen */ }
  }
  return lines
}

// ─── Factores de bullpen por equipo (relevistas) ──────────────────────────────

interface RawTeamStats {
  stats?: Array<{
    splits?: Array<{ team?: { id: number; name: string }; stat: Record<string, unknown> }>
  }>
}

/**
 * Factor de bullpen por equipo = FIP de sus relevistas ÷ FIP medio de los
 * bullpens de la liga (ponderado por innings). Se normaliza a la media de la
 * LIGA (no a la media general) para no sesgar: como los relevistas rinden mejor
 * que los abridores, compararlos contra el promedio global haría ver a todos los
 * bullpens como suprimidores. 1 = bullpen promedio, <1 = mejor que la media.
 * Devuelve un mapa teamId(seed) → factor.
 */
export async function fetchBullpenFactors(
  season: number,
  nameToId: Record<string, string>,
): Promise<Record<string, number>> {
  const url = `${TEAM_STATS_API}?season=${season}&stats=statSplits&sitCodes=rp&group=pitching&sportId=1`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MLB Stats API team-stats ${res.status}`)
  const raw = (await res.json()) as RawTeamStats

  const rows: { teamId: string; fip: number; ip: number }[] = []
  for (const sp of raw.stats?.[0]?.splits ?? []) {
    const teamId = sp.team ? nameToId[sp.team.name] : undefined
    if (!teamId) continue
    const ip = parseInningsPitched((sp.stat.inningsPitched as string | number) ?? 0)
    if (ip <= 0) continue
    const rawFip = computeFIP({
      ip,
      hr: num(sp.stat.homeRuns),
      bb: num(sp.stat.baseOnBalls),
      so: num(sp.stat.strikeOuts),
    })
    rows.push({ teamId, fip: regressedFIP(rawFip, ip), ip })
  }
  if (rows.length === 0) return {}

  const totalIp = rows.reduce((s, r) => s + r.ip, 0)
  const leagueFip = rows.reduce((s, r) => s + r.fip * r.ip, 0) / totalIp

  const factors: Record<string, number> = {}
  for (const r of rows) {
    factors[r.teamId] = Math.min(1.25, Math.max(0.75, r.fip / leagueFip))
  }
  return factors
}
