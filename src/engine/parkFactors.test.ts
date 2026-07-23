import { describe, it, expect } from 'vitest'
import { parkFactor, PARK_FACTORS } from './parkFactors'

describe('parkFactor', () => {
  it('Coors (COL) es el más ofensivo', () => {
    expect(parkFactor('COL')).toBeGreaterThan(1.1)
    expect(parkFactor('COL')).toBe(Math.max(...Object.values(PARK_FACTORS)))
  })
  it('Oracle (SF) es el más pitcher-friendly', () => {
    expect(parkFactor('SF')).toBeLessThan(0.95)
    expect(parkFactor('SF')).toBe(Math.min(...Object.values(PARK_FACTORS)))
  })
  it('equipo desconocido → 1.0 (neutral)', () => expect(parkFactor('XXX')).toBe(1))
  it('cubre los 30 equipos', () => expect(Object.keys(PARK_FACTORS).length).toBe(30))
  it('todos los factores en rango razonable', () => {
    for (const f of Object.values(PARK_FACTORS)) {
      expect(f).toBeGreaterThan(0.85)
      expect(f).toBeLessThan(1.2)
    }
  })
})
