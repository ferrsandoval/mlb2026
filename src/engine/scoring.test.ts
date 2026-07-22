import { describe, it, expect } from 'vitest'
import { brier, logLoss, FLAT_BRIER, FLAT_LOGLOSS } from './scoring'

describe('brier', () => {
  it('predicción perfecta → 0', () => expect(brier([1, 0], 'H')).toBe(0))
  it('predicción totalmente errónea → 1', () => expect(brier([1, 0], 'A')).toBe(1))
  it('predictor plano (50/50) → FLAT_BRIER', () => {
    expect(brier([0.5, 0.5], 'H')).toBeCloseTo(FLAT_BRIER, 5)
    expect(brier([0.5, 0.5], 'A')).toBeCloseTo(FLAT_BRIER, 5)
  })
})

describe('logLoss', () => {
  it('predicción perfecta (p≈1) → cercano a 0', () => {
    expect(logLoss([0.999, 0.001], 'H')).toBeLessThan(0.01)
  })
  it('predictor plano (50/50) → FLAT_LOGLOSS', () => {
    expect(logLoss([0.5, 0.5], 'H')).toBeCloseTo(FLAT_LOGLOSS, 5)
  })
  it('predicción muy confiada y errónea → penalización alta', () => {
    expect(logLoss([0.99, 0.01], 'A')).toBeGreaterThan(4)
  })
})
