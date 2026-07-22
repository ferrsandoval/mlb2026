import { describe, it, expect } from 'vitest'
import {
  parseInningsPitched, computeFIP, regressedFIP, pitcherFactor, buildPitcherRating,
  buildPitcherContext, LEAGUE_FIP, FACTOR_MIN, FACTOR_MAX,
} from './pitchers'
import type { Game } from '../data/seed'

describe('parseInningsPitched', () => {
  it('convierte notación .1/.2 a tercios', () => {
    expect(parseInningsPitched('95.1')).toBeCloseTo(95 + 1 / 3, 6)
    expect(parseInningsPitched('57.2')).toBeCloseTo(57 + 2 / 3, 6)
    expect(parseInningsPitched('80.0')).toBe(80)
    expect(parseInningsPitched(6)).toBe(6)
  })
})

describe('computeFIP', () => {
  it('IP = 0 → media de liga', () => expect(computeFIP({ ip: 0, hr: 0, bb: 0, so: 0 })).toBe(LEAGUE_FIP))
  it('as dominante (muchos SO, pocos BB/HR) → FIP bajo', () => {
    const fip = computeFIP({ ip: 180, hr: 15, bb: 40, so: 240 })
    expect(fip).toBeLessThan(3.0)
  })
  it('abridor malo (pocos SO, muchos HR) → FIP alto', () => {
    const fip = computeFIP({ ip: 100, hr: 25, bb: 45, so: 60 })
    expect(fip).toBeGreaterThan(5.0)
  })
})

describe('regressedFIP', () => {
  it('poca muestra tira hacia la media de liga', () => {
    const near = regressedFIP(2.0, 5)     // 5 IP, FIP brillante
    const far = regressedFIP(2.0, 200)    // 200 IP, se sostiene
    expect(near).toBeGreaterThan(far)
    expect(near).toBeLessThan(LEAGUE_FIP) // aún por debajo de liga, pero regresado
    expect(far).toBeCloseTo((2.0 * 200 + LEAGUE_FIP * 40) / 240, 6)
  })
})

describe('pitcherFactor', () => {
  it('as → factor < 1 (suprime carreras del rival)', () => {
    expect(pitcherFactor(2.8, 180)).toBeLessThan(1)
  })
  it('abridor pésimo → factor > 1', () => {
    expect(pitcherFactor(6.0, 150)).toBeGreaterThan(1)
  })
  it('acotado a [MIN, MAX]', () => {
    expect(pitcherFactor(0.1, 300)).toBeGreaterThanOrEqual(FACTOR_MIN)
    expect(pitcherFactor(15, 300)).toBeLessThanOrEqual(FACTOR_MAX)
  })
  it('el efecto se diluye (~60% abridor): no es tan extremo como FIP/liga puro', () => {
    const f = pitcherFactor(2.0, 300) // regressedFIP ≈ 2.28 → raw ≈ 0.55
    expect(f).toBeGreaterThan(2.28 / LEAGUE_FIP) // diluido hacia 1
  })
})

describe('buildPitcherRating', () => {
  it('produce id string y factor válido', () => {
    const r = buildPitcherRating({ id: 676282, name: 'Joey Cantillo', ip: 95 + 1 / 3, hr: 10, bb: 42, so: 108 })
    expect(r.id).toBe('676282')
    expect(r.factor).toBeGreaterThan(FACTOR_MIN)
    expect(r.factor).toBeLessThan(1) // FIP ~3.5 < liga → suprime
  })
})

describe('buildPitcherContext', () => {
  const games: Game[] = [
    { id: 'G1', date: '2026-04-01', homeId: 'NYY', awayId: 'BOS', stage: 'regular', homePitcherId: '1', awayPitcherId: '2' },
    { id: 'G2', date: '2026-04-01', homeId: 'LAD', awayId: 'SF', stage: 'regular' },
  ]
  const ratings = {
    '1': { id: '1', name: 'Ace', fip: 2.8, ip: 180, factor: 0.82 },
    '2': { id: '2', name: 'Back', fip: 5.0, ip: 120, factor: 1.12 },
  }
  it('solo incluye juegos con abridor conocido', () => {
    const ctx = buildPitcherContext(games, ratings)
    expect(ctx['G1']).toEqual({ homePitcherFactor: 0.82, awayPitcherFactor: 1.12 })
    expect(ctx['G2']).toBeUndefined()
  })
})
