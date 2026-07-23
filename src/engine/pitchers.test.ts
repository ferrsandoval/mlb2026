import { describe, it, expect } from 'vitest'
import {
  parseInningsPitched, computeFIP, regressedFIP, pitcherFactor, buildPitcherRating,
  combineSuppression, buildMatchupContext, LEAGUE_FIP, FACTOR_MIN, FACTOR_MAX, STARTER_GAME_SHARE,
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
  it('produce id string, fipRatio y factor válidos', () => {
    const r = buildPitcherRating({ id: 676282, name: 'Joey Cantillo', ip: 95 + 1 / 3, hr: 10, bb: 42, so: 108 })
    expect(r.id).toBe('676282')
    expect(r.factor).toBeGreaterThan(FACTOR_MIN)
    expect(r.factor).toBeLessThan(1)          // FIP ~3.5 < liga → suprime
    expect(r.fipRatio).toBeCloseTo(r.fip / LEAGUE_FIP, 6)
    expect(r.fipRatio).toBeLessThan(1)
  })
})

describe('combineSuppression', () => {
  it('mezcla abridor (60%) y bullpen (40%)', () => {
    const f = combineSuppression(0.80, 0.90)
    expect(f).toBeCloseTo(STARTER_GAME_SHARE * 0.80 + (1 - STARTER_GAME_SHARE) * 0.90, 6)
  })
  it('sin abridor → usa 1 para su porción, solo ajusta el bullpen', () => {
    const f = combineSuppression(undefined, 0.90)
    expect(f).toBeCloseTo(STARTER_GAME_SHARE * 1 + (1 - STARTER_GAME_SHARE) * 0.90, 6)
  })
  it('acotado a [MIN, MAX]', () => {
    expect(combineSuppression(0.1, 0.1)).toBeGreaterThanOrEqual(FACTOR_MIN)
    expect(combineSuppression(3, 3)).toBeLessThanOrEqual(FACTOR_MAX)
  })
})

describe('buildMatchupContext', () => {
  const games: Game[] = [
    { id: 'G1', date: '2026-04-01', homeId: 'NYY', awayId: 'BOS', stage: 'regular', homePitcherId: '1', awayPitcherId: '2' },
    { id: 'G2', date: '2026-04-01', homeId: 'LAD', awayId: 'SF', stage: 'regular' },
  ]
  const ratings = {
    '1': { id: '1', name: 'Ace', fip: 2.8, ip: 180, fipRatio: 0.85, factor: 0.82 },
    '2': { id: '2', name: 'Back', fip: 5.0, ip: 120, fipRatio: 1.10, factor: 1.12 },
  }
  const bullpens = { NYY: 0.90, BOS: 1.05 }

  it('combina abridor + bullpen + parque en el lado correcto', () => {
    const ctx = buildMatchupContext(games, ratings, bullpens)
    // homePitcherFactor = pitcheo LOCAL (abridor NYY 0.85 + bullpen NYY 0.90)
    expect(ctx['G1'].homePitcherFactor).toBeCloseTo(0.6 * 0.85 + 0.4 * 0.90, 6)
    // awayPitcherFactor = pitcheo VISITANTE (abridor BOS 1.10 + bullpen BOS 1.05)
    expect(ctx['G1'].awayPitcherFactor).toBeCloseTo(0.6 * 1.10 + 0.4 * 1.05, 6)
    expect(ctx['G1'].parkFactor).toBeCloseTo(1.01, 6) // Yankee Stadium
  })

  it('incluye juegos sin abridor si el parque no es neutral (LAD 0.98)', () => {
    const ctx = buildMatchupContext(games, ratings, bullpens)
    expect(ctx['G2']).toBeDefined()
    expect(ctx['G2'].parkFactor).toBeCloseTo(0.98, 6)
    expect(ctx['G2'].homePitcherFactor).toBe(1) // sin abridor ni bullpen → neutral
  })
})
