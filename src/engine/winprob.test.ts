import { describe, it, expect } from 'vitest'
import {
  pythagoreanExpectation, pythagenpatExponent, pythagenpatWinPct, log5, log5HomeField,
} from './winprob'

describe('pythagoreanExpectation', () => {
  it('carreras iguales → .500', () => {
    expect(pythagoreanExpectation(700, 700, 1.83)).toBeCloseTo(0.5, 6)
  })
  it('más carreras a favor → >.500', () => {
    expect(pythagoreanExpectation(800, 650, 1.83)).toBeGreaterThan(0.5)
  })
  it('sin carreras → .500 (evita 0/0)', () => {
    expect(pythagoreanExpectation(0, 0, 1.83)).toBe(0.5)
  })
})

describe('pythagenpatExponent', () => {
  it('en entorno ~9 carreras/juego el exponente ronda 1.8', () => {
    const x = pythagenpatExponent(4.5, 4.5)
    expect(x).toBeGreaterThan(1.7)
    expect(x).toBeLessThan(1.95)
  })
})

describe('pythagenpatWinPct', () => {
  it('0 juegos → .500', () => expect(pythagenpatWinPct(0, 0, 0)).toBe(0.5))
  it('equipo dominante (RF≫RC) proyecta muy por encima de .500', () => {
    const wp = pythagenpatWinPct(500, 380, 100)
    expect(wp).toBeGreaterThan(0.6)
    expect(wp).toBeLessThan(1)
  })
})

describe('log5', () => {
  it('equipos parejos → .500', () => expect(log5(0.5, 0.5)).toBeCloseTo(0.5, 6))
  it('favorito vs promedio conserva su ventaja', () => expect(log5(0.6, 0.5)).toBeCloseTo(0.6, 6))
  it('.600 vs .400 (fórmula clásica de James) ≈ .692', () => {
    expect(log5(0.6, 0.4)).toBeCloseTo(0.692, 3)
  })
  it('simetría: log5(a,b) = 1 − log5(b,a)', () => {
    expect(log5(0.62, 0.44)).toBeCloseTo(1 - log5(0.44, 0.62), 6)
  })
  it('localía sube la probabilidad del local', () => {
    expect(log5HomeField(0.5, 0.5)).toBeGreaterThan(0.5)
  })
})
