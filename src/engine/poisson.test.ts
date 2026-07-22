import { describe, it, expect } from 'vitest'
import { poissonPmf, computeLambdas, buildScoreMatrix } from './poisson'

describe('poissonPmf', () => {
  it('k negativo → 0', () => expect(poissonPmf(4, -1)).toBe(0))
  it('suma de la distribución ≈ 1', () => {
    let sum = 0
    for (let k = 0; k < 40; k++) sum += poissonPmf(4.3, k)
    expect(sum).toBeCloseTo(1, 5)
  })
})

describe('computeLambdas', () => {
  const avg = { elo: 1500, attack: 1, defense: 1 }

  it('equipos parejos → lambdas cercanas con ventaja de local', () => {
    const { lambdaHome, lambdaAway } = computeLambdas(avg, avg)
    expect(lambdaHome).toBeGreaterThan(lambdaAway)
  })

  it('mejor ataque → más carreras esperadas', () => {
    const strong = { ...avg, attack: 1.3 }
    const { lambdaHome: lh1 } = computeLambdas(strong, avg)
    const { lambdaHome: lh2 } = computeLambdas(avg, avg)
    expect(lh1).toBeGreaterThan(lh2)
  })

  it('lambda nunca baja del mínimo', () => {
    const weak = { elo: 1000, attack: 0.3, defense: 2 }
    const { lambdaAway } = computeLambdas(avg, weak)
    expect(lambdaAway).toBeGreaterThanOrEqual(0.5)
  })
})

describe('buildScoreMatrix', () => {
  it('probHome + probAway ≈ 1 (sin empates tras resolver extras)', () => {
    const m = buildScoreMatrix(4.5, 3.8)
    expect(m.probHome + m.probAway).toBeCloseTo(1, 5)
  })

  it('probOver + probUnder = 1', () => {
    const m = buildScoreMatrix(4.5, 3.8)
    expect(m.probOver + m.probUnder).toBeCloseTo(1, 5)
  })

  it('topScorelines está ordenado descendente por probabilidad', () => {
    const m = buildScoreMatrix(4.3, 4.3)
    for (let i = 1; i < m.topScorelines.length; i++) {
      expect(m.topScorelines[i - 1].prob).toBeGreaterThanOrEqual(m.topScorelines[i].prob)
    }
  })

  it('equipo con más lambda tiene mayor probHome', () => {
    const m = buildScoreMatrix(6, 3)
    expect(m.probHome).toBeGreaterThan(m.probAway)
  })
})
