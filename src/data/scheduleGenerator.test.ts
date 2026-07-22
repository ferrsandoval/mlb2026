import { describe, it, expect } from 'vitest'
import { TEAMS, SEASON_START, SEASON_END } from './seed'
import { generateSyntheticSchedule } from './scheduleGenerator'

describe('generateSyntheticSchedule', () => {
  const games = generateSyntheticSchedule(TEAMS, SEASON_START, SEASON_END)

  it('genera 2430 juegos en total (30 equipos × 162 / 2)', () => {
    expect(games.length).toBe(2430)
  })

  it('cada equipo juega exactamente 162 juegos', () => {
    const counts: Record<string, number> = Object.fromEntries(TEAMS.map((t) => [t.id, 0]))
    for (const g of games) { counts[g.homeId]++; counts[g.awayId]++ }
    for (const t of TEAMS) expect(counts[t.id]).toBe(162)
  })

  it('ningún equipo juega dos veces el mismo día', () => {
    const byDate = new Map<string, Set<string>>()
    for (const g of games) {
      const set = byDate.get(g.date) ?? new Set<string>()
      expect(set.has(g.homeId)).toBe(false)
      expect(set.has(g.awayId)).toBe(false)
      set.add(g.homeId); set.add(g.awayId)
      byDate.set(g.date, set)
    }
  })

  it('es determinista (misma seed → mismo calendario)', () => {
    const again = generateSyntheticSchedule(TEAMS, SEASON_START, SEASON_END)
    expect(again.length).toBe(games.length)
    expect(again[0]).toEqual(games[0])
  })

  it('todas las fechas están dentro de la ventana de temporada', () => {
    for (const g of games) {
      expect(g.date >= SEASON_START).toBe(true)
      expect(g.date <= SEASON_END).toBe(true)
    }
  })
})
