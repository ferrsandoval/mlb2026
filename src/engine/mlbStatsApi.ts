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
import { buildPitcherRating, parseInningsPitched } from './pitchers'
import type { PitcherRating } from './pitchers'

const STATS_API = 'https://statsapi.mlb.com/api/v1/schedule'
const PEOPLE_API = 'https://statsapi.mlb.com/api/v1/people'

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
