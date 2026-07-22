import { describe, it, expect } from 'vitest'
import { poissonPmf, negBinomPmf, runPmf, logGamma, computeLambdas, buildScoreMatrix } from './poisson'

describe('poissonPmf', () => {
  it('k negativo → 0', () => expect(poissonPmf(4, -1)).toBe(0))
  it('suma de la distribución ≈ 1', () => {
    let sum = 0
    for (let k = 0; k < 40; k++) sum += poissonPmf(4.3, k)
    expect(sum).toBeCloseTo(1, 5)
  })
})

describe('logGamma', () => {
  it('logGamma(n) = log((n-1)!)', () => {
    expect(logGamma(1)).toBeCloseTo(0, 6)        // 0! = 1
    expect(logGamma(5)).toBeCloseTo(Math.log(24), 6) // 4! = 24
    expect(Math.exp(logGamma(6))).toBeCloseTo(120, 4)
  })
})

describe('negBinomPmf', () => {
  it('k negativo o no entero → 0', () => {
    expect(negBinomPmf(4.3, 4, -1)).toBe(0)
    expect(negBinomPmf(4.3, 4, 2.5)).toBe(0)
  })
  it('suma de la distribución ≈ 1', () => {
    let sum = 0
    for (let k = 0; k < 60; k++) sum += negBinomPmf(4.3, 4, k)
    expect(sum).toBeCloseTo(1, 5)
  })
  it('conserva la media (E[X] ≈ mean)', () => {
    let mean = 0
    for (let k = 0; k < 80; k++) mean += k * negBinomPmf(4.3, 4, k)
    expect(mean).toBeCloseTo(4.3, 3)
  })
  it('sobredispersa: Var = mean + mean²/r', () => {
    const mu = 4.3, r = 4
    let m = 0, m2 = 0
    for (let k = 0; k < 100; k++) { const p = negBinomPmf(mu, r, k); m += k * p; m2 += k * k * p }
    const varNB = m2 - m * m
    expect(varNB).toBeCloseTo(mu + (mu * mu) / r, 2)
    expect(varNB).toBeGreaterThan(mu) // más ancha que Poisson (Var = mean)
  })
  it('size → ∞ recupera Poisson', () => {
    for (const k of [0, 2, 5, 9]) {
      expect(negBinomPmf(4.3, Infinity, k)).toBeCloseTo(poissonPmf(4.3, k), 9)
    }
  })
})

describe('runPmf', () => {
  it('con dispersión finita difiere de Poisson (colas más gruesas)', () => {
    expect(runPmf(4.3, 12, 4)).toBeGreaterThan(poissonPmf(4.3, 12)) // paliza más probable
    expect(runPmf(4.3, 0, 4)).toBeGreaterThan(poissonPmf(4.3, 0))   // blanqueada más probable
  })
  it('con dispersión ∞ = Poisson', () => {
    expect(runPmf(4.3, 5, Infinity)).toBeCloseTo(poissonPmf(4.3, 5), 9)
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
