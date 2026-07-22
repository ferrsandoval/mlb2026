// =============================================================================
// scheduleGenerator.ts — Calendario sintético de 162 juegos por equipo
// -----------------------------------------------------------------------------
// IMPORTANTE: esto NO es el calendario oficial 2026 de MLB (no existe una fuente
// verificable para transcribir 2430 juegos reales a mano sin riesgo de error).
// Es un calendario generado con una distribución realista de rivalidades:
//   - 13 juegos vs cada rival de división (4 rivales × 13 = 52)
//   - 6 juegos vs cada equipo de la misma liga, otra división (10 × 6 = 60)
//   - 3-4 juegos interliga vs los 15 equipos de la otra liga (= 50)
//   Total: 162 juegos/equipo, 2430 juegos en total.
//
// Sirve para que Standings/Postemporada/Monte Carlo funcionen sin conexión.
// Usa "Sincronizar calendario" (MLB Stats API, statsapi.mlb.com) para reemplazar
// estos juegos con el calendario oficial real cuando haya conexión.
// =============================================================================

import type { Team, Game, League } from './seed'
import { divisionKey } from './seed'
import { mulberry32, shuffle } from '../engine/rng'

const SYNTHETIC_SEED = 20260326

interface PairTotal { a: string; b: string; total: number }

function buildPairTotals(teams: Team[]): PairTotal[] {
  const byDivision: Record<string, string[]> = {}
  for (const t of teams) {
    const k = divisionKey(t)
    ;(byDivision[k] ||= []).push(t.id)
  }
  const seen = new Set<string>()
  const pairs: PairTotal[] = []

  function addPair(a: string, b: string, total: number) {
    const key = [a, b].sort().join('-')
    if (seen.has(key)) return
    seen.add(key)
    pairs.push({ a, b, total })
  }

  // Rivales de división: 13 juegos
  for (const ids of Object.values(byDivision)) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) addPair(ids[i], ids[j], 13)
    }
  }

  // Misma liga, otra división: 6 juegos
  for (const league of ['AL', 'NL'] as League[]) {
    const ids = teams.filter((t) => t.league === league).map((t) => t.id)
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) addPair(ids[i], ids[j], 6)
    }
  }

  // Interliga: distribución 5 rivales×4 + 10 rivales×3 = 50, balanceada por
  // filas y columnas usando (j - i) mod 15 (ver comentario en el módulo).
  const al = teams.filter((t) => t.league === 'AL').map((t) => t.id).sort()
  const nl = teams.filter((t) => t.league === 'NL').map((t) => t.id).sort()
  for (let i = 0; i < al.length; i++) {
    for (let j = 0; j < nl.length; j++) {
      const w = (((j - i) % 15) + 15) % 15 < 5 ? 4 : 3
      addPair(al[i], nl[j], w)
    }
  }

  return pairs
}

interface GameDraft { homeId: string; awayId: string }

function expandToDrafts(pairs: PairTotal[]): GameDraft[] {
  const drafts: GameDraft[] = []
  for (const { a, b, total } of pairs) {
    const homeForA = Math.ceil(total / 2)
    const homeForB = total - homeForA
    for (let k = 0; k < homeForA; k++) drafts.push({ homeId: a, awayId: b })
    for (let k = 0; k < homeForB; k++) drafts.push({ homeId: b, awayId: a })
  }
  return drafts
}

function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start + 'T12:00:00Z')
  const endDate = new Date(end + 'T12:00:00Z')
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return dates
}

/**
 * Genera un calendario sintético de 162 juegos por equipo (2430 en total).
 * Determinista: misma seed → mismo calendario, para snapshots estables.
 */
export function generateSyntheticSchedule(
  teams: Team[],
  seasonStart: string,
  seasonEnd: string,
  seed = SYNTHETIC_SEED,
): Game[] {
  const rng = mulberry32(seed)
  const pairs = buildPairTotals(teams)
  const drafts = shuffle(expandToDrafts(pairs), rng)
  const dates = enumerateDates(seasonStart, seasonEnd)

  const remaining = [...drafts]
  const games: Game[] = []
  let gid = 1
  let dayIdx = 0
  let guard = 0
  const maxGuard = dates.length * 4

  while (remaining.length > 0 && guard < maxGuard) {
    const date = dates[dayIdx % dates.length]
    const busy = new Set<string>()
    for (let i = remaining.length - 1; i >= 0; i--) {
      const g = remaining[i]
      if (busy.has(g.homeId) || busy.has(g.awayId)) continue
      busy.add(g.homeId)
      busy.add(g.awayId)
      games.push({ id: `G${gid++}`, date, homeId: g.homeId, awayId: g.awayId, stage: 'regular' })
      remaining.splice(i, 1)
    }
    dayIdx++
    guard++
  }

  // Cualquier residual (no debería ocurrir con 30 equipos/186 días) se agrega
  // en la última fecha, sin importar choques — caso límite del generador.
  const lastDate = dates[dates.length - 1]
  for (const g of remaining) {
    games.push({ id: `G${gid++}`, date: lastDate, homeId: g.homeId, awayId: g.awayId, stage: 'regular' })
  }

  games.sort((a, b) => a.date.localeCompare(b.date) || Number(a.id.slice(1)) - Number(b.id.slice(1)))
  return games
}
