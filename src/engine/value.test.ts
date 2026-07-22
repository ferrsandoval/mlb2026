import { describe, it, expect } from 'vitest'
import { impliedProb, kellyFraction, analyzeValue } from './value'

describe('impliedProb', () => {
  it('cuota 2.00 → 50%', () => expect(impliedProb(2.0)).toBeCloseTo(0.5, 5))
  it('cuota inválida (≤1) → 1', () => expect(impliedProb(1)).toBe(1))
})

describe('kellyFraction', () => {
  it('sin edge (modelProb = impliedProb) → cercano a 0', () => {
    const f = kellyFraction(2.0, 0.5)
    expect(f).toBeCloseTo(0, 5)
  })
  it('edge positivo → fracción positiva', () => {
    expect(kellyFraction(2.2, 0.55)).toBeGreaterThan(0)
  })
  it('edge negativo → 0 (nunca apuesta negativo)', () => {
    expect(kellyFraction(1.5, 0.4)).toBe(0)
  })
})

describe('analyzeValue', () => {
  it('cuotas inválidas → null', () => {
    expect(analyzeValue({ home: null, away: 1.9 }, { home: 0.5, away: 0.5 })).toBeNull()
  })

  it('detecta valor cuando el modelo da más probabilidad que la cuota implica', () => {
    const result = analyzeValue({ home: 2.5, away: 1.6 }, { home: 0.55, away: 0.45 })
    expect(result).not.toBeNull()
    expect(result!.markets.home.hasValue).toBe(true)
  })

  it('overround > 1 refleja el margen de la casa', () => {
    const result = analyzeValue({ home: 1.9, away: 1.9 }, { home: 0.5, away: 0.5 })
    expect(result!.overround).toBeGreaterThan(1)
  })
})
