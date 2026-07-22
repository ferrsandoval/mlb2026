import { describe, it, expect } from 'vitest'
import { createSeries, seriesWinner, createWildCardRound, gamesToWin } from './postseason'

describe('gamesToWin', () => {
  it('mejor de 3 → 2 triunfos', () => expect(gamesToWin(3)).toBe(2))
  it('mejor de 5 → 3 triunfos', () => expect(gamesToWin(5)).toBe(3))
  it('mejor de 7 → 4 triunfos', () => expect(gamesToWin(7)).toBe(4))
})

describe('createSeries', () => {
  it('todos los juegos de una serie al mejor de 3 son en casa del seed alto', () => {
    const s = createSeries('X', 'WC', 'AL', 3, 'HOU', 3, 'SEA', 6)
    expect(s.games.every((g) => g.homeId === 'HOU')).toBe(true)
  })

  it('serie al mejor de 5 sigue el patrón 2-2-1', () => {
    const s = createSeries('X', 'LDS', 'AL', 5, 'HOU', 1, 'SEA', 4)
    const homeIds = s.games.map((g) => g.homeId)
    expect(homeIds).toEqual(['HOU', 'HOU', 'SEA', 'SEA', 'HOU'])
  })
})

describe('seriesWinner', () => {
  it('sin juegos jugados → null', () => {
    const s = createSeries('X', 'WC', 'AL', 3, 'HOU', 3, 'SEA', 6)
    expect(seriesWinner(s)).toBeNull()
  })

  it('el seed alto gana 2 juegos primero → gana la serie', () => {
    const s = createSeries('X', 'WC', 'AL', 3, 'HOU', 3, 'SEA', 6)
    s.games[0].homeRuns = 5; s.games[0].awayRuns = 2 // HOU gana (local)
    s.games[1].homeRuns = 4; s.games[1].awayRuns = 1 // HOU gana
    expect(seriesWinner(s)).toBe('HOU')
  })

  it('el seed bajo puede ganar si gana la mayoría', () => {
    const s = createSeries('X', 'WC', 'AL', 3, 'HOU', 3, 'SEA', 6)
    s.games[0].homeRuns = 2; s.games[0].awayRuns = 5 // SEA gana de visitante
    s.games[1].homeRuns = 1; s.games[1].awayRuns = 4 // SEA gana
    expect(seriesWinner(s)).toBe('SEA')
  })
})

describe('createWildCardRound', () => {
  it('crea 2 series: 3vs6 y 4vs5', () => {
    const seeds = [1, 2, 3, 4, 5, 6].map((seed) => ({ teamId: `T${seed}`, seed }))
    const round = createWildCardRound('AL', seeds)
    expect(round).toHaveLength(2)
    expect(round[0].higherSeedNum).toBe(3)
    expect(round[0].lowerSeedNum).toBe(6)
    expect(round[1].higherSeedNum).toBe(4)
    expect(round[1].lowerSeedNum).toBe(5)
  })
})
