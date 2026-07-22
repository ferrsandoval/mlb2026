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

const STATS_API = 'https://statsapi.mlb.com/api/v1/schedule'

interface RawTeam {
  team: { id: number; name: string }
  score?: number
  isWinner?: boolean
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
      })
    }
  }
  return events
}

export async function fetchMlbSchedule(startDate: string, endDate: string, season: number): Promise<MlbGameEvent[]> {
  const url = `${STATS_API}?sportId=1&season=${season}&startDate=${startDate}&endDate=${endDate}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MLB Stats API ${res.status}`)
  const raw = (await res.json()) as RawSchedule
  return parseEvents(raw)
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
    })
  }

  return { games, unmatched }
}

export interface ScoreSyncResult {
  updated: number
  unmatched: string[]
  errors: string[]
}
