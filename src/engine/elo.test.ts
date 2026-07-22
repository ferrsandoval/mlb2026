import { describe, it, expect } from 'vitest'
import { eloWinExpectancy, runMarginFactor, updateElo, gameResult } from './elo'

describe('eloWinExpectancy', () => {
  it('equipos iguales → We = 0.5', () => {
    expect(eloWinExpectancy(1500, 1500)).toBeCloseTo(0.5, 5)
  })

  it('equipo muy superior → We > 0.9', () => {
    expect(eloWinExpectancy(1800, 1200)).toBeGreaterThan(0.9)
  })

  it('bonus de localía aumenta We', () => {
    const sin = eloWinExpectancy(1500, 1500, 0)
    const con = eloWinExpectancy(1500, 1500, 24)
    expect(con).toBeGreaterThan(sin)
  })
})

describe('runMarginFactor', () => {
  it('margen 0 → factor = 1', () => expect(runMarginFactor(0)).toBe(1))
  it('margen mayor → factor mayor', () => {
    expect(runMarginFactor(5)).toBeGreaterThan(runMarginFactor(1))
  })
  it('funciona con diferencia negativa', () => {
    expect(runMarginFactor(-3)).toBe(runMarginFactor(3))
  })
})

describe('gameResult', () => {
  it('victoria local → 1', () => expect(gameResult(4, 2)).toBe(1))
  it('derrota local → 0', () => expect(gameResult(2, 4)).toBe(0))
})

describe('updateElo', () => {
  it('local que gana con expectativa 50% sube puntos', () => {
    const { deltaHome } = updateElo({ elo: 1500 }, { elo: 1500 }, 4, 2)
    expect(deltaHome).toBeGreaterThan(0)
  })

  it('local que pierde baja puntos', () => {
    const { deltaHome } = updateElo({ elo: 1500 }, { elo: 1500 }, 2, 4)
    expect(deltaHome).toBeLessThan(0)
  })

  it('los nuevos Elo son enteros', () => {
    const { newEloHome, newEloAway } = updateElo({ elo: 1500 }, { elo: 1500 }, 5, 3)
    expect(Number.isInteger(newEloHome)).toBe(true)
    expect(Number.isInteger(newEloAway)).toBe(true)
  })

  it('el K es pequeño (juegos individuales no mueven mucho el Elo)', () => {
    const { deltaHome } = updateElo({ elo: 1500 }, { elo: 1500 }, 4, 3)
    expect(Math.abs(deltaHome)).toBeLessThan(10)
  })
})
