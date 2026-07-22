// =============================================================================
// useStore.ts — Estado global con Zustand + persistencia en localStorage
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TEAMS, SEASON_START, SEASON_END } from '../data/seed'
import type { Team, Game, League } from '../data/seed'
import { generateSyntheticSchedule } from '../data/scheduleGenerator'
import type { OddsInput, GamePrediction } from '../types'
import type { PersonalPick } from '../engine/personalPicks'
import { predictAll, computeLambdas, buildScoreMatrix } from '../engine/poisson'
import { updateElo } from '../engine/elo'
import {
  createWildCardRound, createDivisionSeries, createLeagueChampionship, createWorldSeries,
  seriesWinner,
} from '../data/postseason'
import type { Series, SeedEntry } from '../data/postseason'
import { computeLeagueStandings, computeDivisionWinners, computeWildCardStandings } from '../engine/standings'
import { fetchMlbSchedule, buildNameToId, buildGamesFromEvents } from '../engine/mlbStatsApi'

// ─── Tipos del store ──────────────────────────────────────────────────────────

interface StoreState {
  teams: Record<string, Team>
  games: Game[]
  odds: Record<string, OddsInput>
  predictions: Record<string, GamePrediction>
  personalPicks: Record<string, PersonalPick>
  postseasonSeries: Series[]
  postseasonSeeds: Record<League, SeedEntry[]> | null
  valueThreshold: number
  kellyFraction: number
  scheduleSource: 'synthetic' | 'mlb-stats-api'

  setTeamElo: (teamId: string, elo: number) => void
  setTeamAttack: (teamId: string, attack: number) => void
  setTeamDefense: (teamId: string, defense: number) => void
  setOdds: (gameId: string, odds: OddsInput) => void
  setPersonalPick: (gameId: string, pick: PersonalPick | null) => void
  loadPersonalPicks: (picks: Record<string, PersonalPick>) => void
  registerResult: (gameId: string, homeRuns: number, awayRuns: number) => void
  setValueThreshold: (v: number) => void
  setKellyFraction: (v: number) => void
  recalcPredictions: () => void

  // Postemporada
  generatePostseason: () => void
  autoAdvancePostseason: () => void
  registerSeriesGame: (seriesId: string, gameNum: number, homeRuns: number, awayRuns: number) => void
  clearSeriesGame: (seriesId: string, gameNum: number) => void
  resetPostseason: () => void

  // Sincronización
  syncSchedule: () => Promise<{ added: number; unmatched: string[] }>
  syncScores: () => Promise<{ updated: number; errors: string[] }>

  exportJSON: () => string
  importJSON: (json: string) => void
  resetToSeed: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildInitialTeams(): Record<string, Team> {
  return Object.fromEntries(TEAMS.map((t) => [t.id, { ...t }]))
}

function buildInitialGames(): Game[] {
  return generateSyntheticSchedule(TEAMS, SEASON_START, SEASON_END)
}

function currentWinsByTeam(teams: Record<string, Team>, games: Game[]): Record<string, number> {
  const wins: Record<string, number> = Object.fromEntries(Object.keys(teams).map((id) => [id, 0]))
  for (const g of games) {
    if (!g.played || g.homeRuns == null || g.awayRuns == null) continue
    if (g.homeRuns > g.awayRuns) wins[g.homeId]++
    else wins[g.awayId]++
  }
  return wins
}

/** Predicción de un solo juego "neutral" para comparar dos equipos (favorito de serie/postemporada). */
function quickMatchup(home: Team, away: Team) {
  const { lambdaHome, lambdaAway } = computeLambdas(home, away)
  return buildScoreMatrix(lambdaHome, lambdaAway)
}

/**
 * Crea la siguiente ronda de postemporada cuando la ronda anterior ya está
 * resuelta (todas sus series tienen winnerId). Pura — no decide ganadores,
 * solo propaga. Usa `seeds` (guardado al generar la postemporada) para poder
 * ubicar a los equipos con bye (seeds 1 y 2), que no tienen serie en el Wild Card.
 */
function advanceRounds(series: Series[], seeds: Record<League, SeedEntry[]> | null): Series[] {
  if (!seeds) return series
  let next = series

  for (const league of ['AL', 'NL'] as League[]) {
    const leagueSeeds = seeds[league]
    const wc = next.filter((sr) => sr.league === league && sr.round === 'WC')
    const hasLds = next.some((sr) => sr.league === league && sr.round === 'LDS')
    if (!hasLds && wc.length === 2 && wc.every((sr) => sr.winnerId)) {
      const winners = wc.map((sr) => ({
        teamId: sr.winnerId!,
        seed: sr.winnerId === sr.higherSeedId ? sr.higherSeedNum : sr.lowerSeedNum,
      }))
      next = [...next, ...createDivisionSeries(league, leagueSeeds, winners)]
    }

    const lds = next.filter((sr) => sr.league === league && sr.round === 'LDS')
    const hasLcs = next.some((sr) => sr.league === league && sr.round === 'LCS')
    if (!hasLcs && lds.length === 2 && lds.every((sr) => sr.winnerId)) {
      const winners = lds.map((sr) => ({
        teamId: sr.winnerId!,
        seed: sr.winnerId === sr.higherSeedId ? sr.higherSeedNum : sr.lowerSeedNum,
      }))
      next = [...next, createLeagueChampionship(league, winners)]
    }
  }

  const alLcs = next.find((sr) => sr.league === 'AL' && sr.round === 'LCS')
  const nlLcs = next.find((sr) => sr.league === 'NL' && sr.round === 'LCS')
  const hasWs = next.some((sr) => sr.round === 'WS')
  if (!hasWs && alLcs?.winnerId && nlLcs?.winnerId) {
    const alChamp = { teamId: alLcs.winnerId, seed: alLcs.winnerId === alLcs.higherSeedId ? alLcs.higherSeedNum : alLcs.lowerSeedNum }
    const nlChamp = { teamId: nlLcs.winnerId, seed: nlLcs.winnerId === nlLcs.higherSeedId ? nlLcs.higherSeedNum : nlLcs.lowerSeedNum }
    next = [...next, createWorldSeries(alChamp, nlChamp)]
  }

  return next
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      teams: buildInitialTeams(),
      games: buildInitialGames(),
      odds: {},
      predictions: predictAll(buildInitialGames(), buildInitialTeams()),
      personalPicks: {},
      postseasonSeries: [],
      postseasonSeeds: null,
      valueThreshold: 0.03,
      kellyFraction: 0.5,
      scheduleSource: 'synthetic',

      setTeamElo: (teamId, elo) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], elo } }
          return { teams, predictions: predictAll(s.games, teams) }
        })
      },

      setTeamAttack: (teamId, attack) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], attack } }
          return { teams, predictions: predictAll(s.games, teams) }
        })
      },

      setTeamDefense: (teamId, defense) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], defense } }
          return { teams, predictions: predictAll(s.games, teams) }
        })
      },

      setOdds: (gameId, odds) => set((s) => ({ odds: { ...s.odds, [gameId]: odds } })),

      setPersonalPick: (gameId, pick) => {
        set((s) => {
          const next = { ...s.personalPicks }
          if (pick === null) delete next[gameId]
          else next[gameId] = pick
          return { personalPicks: next }
        })
      },

      loadPersonalPicks: (picks) => set((s) => ({ personalPicks: { ...s.personalPicks, ...picks } })),

      registerResult: (gameId, homeRuns, awayRuns) => {
        set((s) => {
          const game = s.games.find((g) => g.id === gameId)
          if (!game) return s
          const homeTeam = s.teams[game.homeId]
          const awayTeam = s.teams[game.awayId]
          if (!homeTeam || !awayTeam) return s

          const { newEloHome, newEloAway } = updateElo(homeTeam, awayTeam, homeRuns, awayRuns)
          const teams: Record<string, Team> = {
            ...s.teams,
            [game.homeId]: { ...homeTeam, elo: newEloHome },
            [game.awayId]: { ...awayTeam, elo: newEloAway },
          }
          const games = s.games.map((g) => (g.id === gameId ? { ...g, played: true, homeRuns, awayRuns } : g))

          return { teams, games, predictions: predictAll(games, teams) }
        })
      },

      setValueThreshold: (v) => set({ valueThreshold: v }),
      setKellyFraction: (v) => set({ kellyFraction: v }),

      recalcPredictions: () => {
        const { games, teams } = get()
        set({ predictions: predictAll(games, teams) })
      },

      // ── Postemporada ────────────────────────────────────────────────────────

      generatePostseason: () => {
        const { games, teams, predictions } = get()
        const series: Series[] = []
        const seeds = {} as Record<League, SeedEntry[]>

        for (const league of ['AL', 'NL'] as League[]) {
          const leagueStandings = computeLeagueStandings(league, games, teams, predictions)
          const divisionWinners = computeDivisionWinners(league, games, teams, predictions)
          const winnerIds = new Set(divisionWinners.map((s) => s.team.id))
          const wildcards = computeWildCardStandings(leagueStandings, winnerIds).slice(0, 3)

          const sortedWinners = [...divisionWinners].sort((a, b) => b.projWins - a.projWins)
          const leagueSeeds: SeedEntry[] = [...sortedWinners, ...wildcards].map((s, i) => ({ teamId: s.team.id, seed: i + 1 }))
          seeds[league] = leagueSeeds

          series.push(...createWildCardRound(league, leagueSeeds))
        }

        set({ postseasonSeries: series, postseasonSeeds: seeds })
      },

      autoAdvancePostseason: () => {
        set((s) => {
          let series = s.postseasonSeries.map((sr) => ({ ...sr, games: sr.games.map((g) => ({ ...g })) }))
          let changed = true
          let guard = 0

          while (changed && guard < 20) {
            changed = false
            guard++

            for (let i = 0; i < series.length; i++) {
              const sr = series[i]
              if (sr.winnerId) continue
              const home = s.teams[sr.higherSeedId]
              const away = s.teams[sr.lowerSeedId]
              if (!home || !away) continue
              const matrix = quickMatchup(home, away)
              const winnerId = matrix.probHome >= matrix.probAway ? sr.higherSeedId : sr.lowerSeedId
              series[i] = { ...sr, winnerId }
              changed = true
            }

            const advanced = advanceRounds(series, s.postseasonSeeds)
            if (advanced.length !== series.length) { series = advanced; changed = true }
          }

          return { postseasonSeries: series }
        })
      },

      registerSeriesGame: (seriesId, gameNum, homeRuns, awayRuns) => {
        set((s) => {
          let series = s.postseasonSeries.map((sr) =>
            sr.id === seriesId
              ? { ...sr, games: sr.games.map((g) => (g.gameNum === gameNum ? { ...g, homeRuns, awayRuns } : g)) }
              : sr,
          )
          const sr = series.find((x) => x.id === seriesId)!
          const winnerId = seriesWinner(sr)
          series = series.map((x) => (x.id === seriesId ? { ...x, winnerId } : x))
          series = advanceRounds(series, s.postseasonSeeds)
          return { postseasonSeries: series }
        })
      },

      clearSeriesGame: (seriesId, gameNum) => {
        set((s) => {
          let series = s.postseasonSeries.map((sr) =>
            sr.id === seriesId
              ? { ...sr, games: sr.games.map((g) => (g.gameNum === gameNum ? { ...g, homeRuns: null, awayRuns: null } : g)) }
              : sr,
          )
          const sr = series.find((x) => x.id === seriesId)!
          series = series.map((x) => (x.id === seriesId ? { ...x, winnerId: seriesWinner(sr) } : x))
          return { postseasonSeries: series }
        })
      },

      resetPostseason: () => set({ postseasonSeries: [], postseasonSeeds: null }),

      // ── Sincronización con MLB Stats API ────────────────────────────────────

      syncSchedule: async () => {
        const season = new Date(SEASON_START).getFullYear()
        const events = await fetchMlbSchedule(SEASON_START, SEASON_END, season)
        const nameToId = buildNameToId(TEAMS)
        const { games, unmatched } = buildGamesFromEvents(events, nameToId)
        set({ games, scheduleSource: 'mlb-stats-api', predictions: predictAll(games, get().teams) })
        return { added: games.length, unmatched }
      },

      syncScores: async () => {
        const errors: string[] = []
        let updated = 0
        try {
          const today = new Date().toISOString().slice(0, 10)
          const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
          const season = new Date(SEASON_START).getFullYear()
          const events = await fetchMlbSchedule(weekAgo, today, season)

          set((s) => {
            const byId = new Map(s.games.map((g) => [g.id, g]))
            for (const ev of events) {
              if (!ev.completed || ev.homeRuns == null || ev.awayRuns == null) continue
              const id = `MLB${ev.gamePk}`
              const existing = byId.get(id)
              if (existing && !existing.played) {
                byId.set(id, { ...existing, played: true, homeRuns: ev.homeRuns, awayRuns: ev.awayRuns })
                updated++
              }
            }
            const games = [...byId.values()]
            return { games, predictions: predictAll(games, s.teams) }
          })
        } catch {
          errors.push('No se pudo conectar con MLB Stats API')
        }
        return { updated, errors }
      },

      exportJSON: () => {
        const { teams, games, odds, personalPicks, postseasonSeries, postseasonSeeds, valueThreshold, kellyFraction } = get()
        return JSON.stringify({ teams, games, odds, personalPicks, postseasonSeries, postseasonSeeds, valueThreshold, kellyFraction }, null, 2)
      },

      importJSON: (json) => {
        try {
          const data = JSON.parse(json)
          const teams: Record<string, Team> = data.teams ?? buildInitialTeams()
          const games: Game[] = data.games ?? buildInitialGames()
          set({
            teams,
            games,
            odds: data.odds ?? {},
            personalPicks: data.personalPicks ?? {},
            postseasonSeries: data.postseasonSeries ?? [],
            postseasonSeeds: data.postseasonSeeds ?? null,
            valueThreshold: data.valueThreshold ?? 0.03,
            kellyFraction: data.kellyFraction ?? 0.5,
            predictions: predictAll(games, teams),
          })
        } catch {
          console.error('Error al importar JSON')
        }
      },

      resetToSeed: () => {
        const teams = buildInitialTeams()
        const games = buildInitialGames()
        set({
          teams, games, odds: {}, personalPicks: {}, postseasonSeries: [], postseasonSeeds: null,
          predictions: predictAll(games, teams),
          valueThreshold: 0.03, kellyFraction: 0.5, scheduleSource: 'synthetic',
        })
      },
    }),
    {
      name: 'mlb2026-state',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        teams: s.teams,
        games: s.games,
        odds: s.odds,
        personalPicks: s.personalPicks,
        postseasonSeries: s.postseasonSeries,
        postseasonSeeds: s.postseasonSeeds,
        valueThreshold: s.valueThreshold,
        kellyFraction: s.kellyFraction,
        scheduleSource: s.scheduleSource,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.predictions = predictAll(state.games, state.teams)
      },
    },
  ),
)

// Exportado para uso en Monte Carlo desde las páginas (evita recomputar wins ahí).
export { currentWinsByTeam }
