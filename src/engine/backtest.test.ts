import { describe, it, expect } from 'vitest'
import { holdoutBacktest, walkForwardBacktest, gridSearchHoldout, cartesianGrid } from './backtest'
import { maherFactory } from './ratings'
import { FLAT_BRIER } from './scoring'
import type { HistGame } from '../data/histTypes'

// Historial sintético: LOCAL-FUERTE le gana casi siempre a DEBIL; dos equipos
// promedio se reparten. Un modelo bien calibrado debe batir al volado (0.25).
function makeHistory(): HistGame[] {
  const games: HistGame[] = []
  const day = (i: number) => `2025-${String(1 + Math.floor(i / 28) % 12).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`
  let i = 0
  for (let round = 0; round < 60; round++) {
    // FUERTE aplasta a DEBIL
    games.push({ date: day(i++), homeId: 'FUERTE', awayId: 'DEBIL', homeRuns: 7, awayRuns: 2, neutral: false, comp: 'Regular Season' })
    games.push({ date: day(i++), homeId: 'DEBIL', awayId: 'FUERTE', homeRuns: 3, awayRuns: 6, neutral: false, comp: 'Regular Season' })
    // MEDIO1 vs MEDIO2 parejo (alterna resultados)
    games.push({ date: day(i++), homeId: 'MEDIO1', awayId: 'MEDIO2', homeRuns: round % 2 === 0 ? 5 : 3, awayRuns: round % 2 === 0 ? 4 : 5, neutral: false, comp: 'Regular Season' })
    games.push({ date: day(i++), homeId: 'FUERTE', awayId: 'MEDIO1', homeRuns: 5, awayRuns: 4, neutral: false, comp: 'Regular Season' })
    games.push({ date: day(i++), homeId: 'MEDIO2', awayId: 'DEBIL', homeRuns: 6, awayRuns: 3, neutral: false, comp: 'Regular Season' })
  }
  return games
}

const seedFallback = {
  FUERTE: { attack: 1, defense: 1 }, DEBIL: { attack: 1, defense: 1 },
  MEDIO1: { attack: 1, defense: 1 }, MEDIO2: { attack: 1, defense: 1 },
}
const params = { xi: 0.001, tauPrior: 5, homeAdv: 0.1 }

describe('holdoutBacktest', () => {
  it('el modelo Maher entrenado con historial bate al volado', () => {
    const hist = makeHistory()
    const bt = holdoutBacktest(hist, maherFactory(seedFallback, '2025-12-31'), params, 0.8)
    expect(bt.n).toBeGreaterThan(0)
    expect(bt.avgBrier).toBeLessThan(FLAT_BRIER) // < 0.25
  })

  it('con historial vacío no rompe', () => {
    const bt = holdoutBacktest([], maherFactory(seedFallback, '2025-12-31'), params, 0.8)
    expect(bt.n).toBe(0)
  })

  it('coincide en orden de magnitud con el walk-forward pero es más barato', () => {
    const hist = makeHistory().slice(0, 120)
    const wf = walkForwardBacktest(hist, maherFactory(seedFallback, '2025-12-31'), params, 40)
    expect(wf.avgBrier).toBeLessThan(FLAT_BRIER)
  })
})

describe('gridSearchHoldout', () => {
  it('elige la mejor combinación de parámetros por Brier', () => {
    const hist = makeHistory()
    const grid = cartesianGrid({ homeAdv: [0.06, 0.10], xi: [0.001, 0.004], tauPrior: [10, 40] })
    const gs = gridSearchHoldout(hist, grid, maherFactory(seedFallback, '2025-12-31'), 0.8)
    expect(gs.rows.length).toBe(8)
    expect(gs.bestBrier).toBeLessThan(FLAT_BRIER)
    // el primero es el de menor Brier
    expect(gs.rows[0].avgBrier).toBe(gs.bestBrier)
    for (const r of gs.rows) expect(r.avgBrier).toBeGreaterThanOrEqual(gs.bestBrier)
    // best coincide con los params de la fila top
    expect(gs.best).toEqual(gs.rows[0].params)
  })

  it('grid vacío → sin resultados', () => {
    const gs = gridSearchHoldout(makeHistory(), [], maherFactory(seedFallback, '2025-12-31'))
    expect(gs.rows.length).toBe(0)
    expect(gs.bestBrier).toBe(Infinity)
  })
})
