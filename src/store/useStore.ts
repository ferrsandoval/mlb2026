// =============================================================================
// useStore.ts — Estado global con Zustand + persistencia en localStorage
// =============================================================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { TEAMS, SEASON_START, SEASON_END } from '../data/seed'
import type { Team, Game, League } from '../data/seed'
import { generateSyntheticSchedule } from '../data/scheduleGenerator'
import type { OddsInput, GamePrediction } from '../types'
import { predictAll, computeLambdas, buildScoreMatrix } from '../engine/poisson'
import { updateElo } from '../engine/elo'
import {
  createWildCardRound, createDivisionSeries, createLeagueChampionship, createWorldSeries,
  seriesWinner,
} from '../data/postseason'
import type { Series, SeedEntry } from '../data/postseason'
import { computeLeagueStandings, computeDivisionWinners, computeWildCardStandings } from '../engine/standings'
import { fetchMlbSchedule, buildNameToId, buildGamesFromEvents, fetchPitcherRatings, fetchBullpenFactors, fetchMarketLines } from '../engine/mlbStatsApi'
import { buildMatchupContext } from '../engine/pitchers'
import type { PitcherRating } from '../engine/pitchers'
import { loadHistoricalGames } from '../data/historicalLoader'
import { estimateRatings, maherFactory, DEFAULT_MAHER_PARAMS } from '../engine/ratings'
import { gridSearchHoldout, cartesianGrid } from '../engine/backtest'

// ─── Tipos del store ──────────────────────────────────────────────────────────

interface StoreState {
  teams: Record<string, Team>
  games: Game[]
  odds: Record<string, OddsInput>
  predictions: Record<string, GamePrediction>
  pitchers: Record<string, PitcherRating>
  bullpens: Record<string, number>
  postseasonSeries: Series[]
  postseasonSeeds: Record<League, SeedEntry[]> | null
  valueThreshold: number
  kellyFraction: number
  scheduleSource: 'synthetic' | 'mlb-stats-api'

  setTeamElo: (teamId: string, elo: number) => void
  setTeamAttack: (teamId: string, attack: number) => void
  setTeamDefense: (teamId: string, defense: number) => void
  setOdds: (gameId: string, odds: OddsInput) => void
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
  syncSchedule: () => Promise<{ added: number; unmatched: string[]; rated: number }>
  syncScores: () => Promise<{ updated: number; errors: string[] }>
  syncPitchers: () => Promise<{ rated: number; patched: number; errors: string[] }>
  syncLines: () => Promise<{ updated: number; errors: string[] }>
  calibrateFromHistory: () => Promise<{ games: number; brier: number | null; teamsUpdated: number; errors: string[] }>

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

/** Predicciones con el contexto completo por juego: abridor + bullpen + parque. */
function predictWithCtx(
  games: Game[],
  teams: Record<string, Team>,
  pitchers: Record<string, PitcherRating>,
  bullpens: Record<string, number> = {},
): Record<string, GamePrediction> {
  return predictAll(games, teams, buildMatchupContext(games, pitchers, bullpens))
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
      pitchers: {},
      bullpens: {},
      postseasonSeries: [],
      postseasonSeeds: null,
      valueThreshold: 0.03,
      kellyFraction: 0.5,
      scheduleSource: 'synthetic',

      setTeamElo: (teamId, elo) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], elo } }
          return { teams, predictions: predictWithCtx(s.games, teams, s.pitchers, s.bullpens) }
        })
      },

      setTeamAttack: (teamId, attack) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], attack } }
          return { teams, predictions: predictWithCtx(s.games, teams, s.pitchers, s.bullpens) }
        })
      },

      setTeamDefense: (teamId, defense) => {
        set((s) => {
          const teams = { ...s.teams, [teamId]: { ...s.teams[teamId], defense } }
          return { teams, predictions: predictWithCtx(s.games, teams, s.pitchers, s.bullpens) }
        })
      },

      setOdds: (gameId, odds) => set((s) => ({ odds: { ...s.odds, [gameId]: odds } })),

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

          return { teams, games, predictions: predictWithCtx(games, teams, s.pitchers, s.bullpens) }
        })
      },

      setValueThreshold: (v) => set({ valueThreshold: v }),
      setKellyFraction: (v) => set({ kellyFraction: v }),

      recalcPredictions: () => {
        const { games, teams, pitchers, bullpens } = get()
        set({ predictions: predictWithCtx(games, teams, pitchers, bullpens) })
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

        // El calendario ya trae el abridor probable (hydrate). Descargamos de una
        // vez los ratings FIP de los abridores de juegos pendientes y los factores
        // de bullpen por equipo, para que marcadores y probabilidades ya salgan
        // ajustados por pitcheo.
        let pitchers = get().pitchers
        let bullpens = get().bullpens
        let rated = 0
        try {
          const ids = new Set<string>()
          for (const g of games) {
            if (g.played) continue
            if (g.homePitcherId) ids.add(g.homePitcherId)
            if (g.awayPitcherId) ids.add(g.awayPitcherId)
          }
          if (ids.size > 0) {
            const fresh = await fetchPitcherRatings([...ids], season)
            pitchers = { ...pitchers, ...fresh }
            rated = Object.keys(fresh).length
          }
        } catch { /* el calendario se carga aunque falle la descarga de abridores */ }
        try { bullpens = { ...bullpens, ...(await fetchBullpenFactors(season, nameToId)) } } catch { /* opcional */ }

        set((s) => ({ games, pitchers, bullpens, scheduleSource: 'mlb-stats-api', predictions: predictWithCtx(games, s.teams, pitchers, bullpens) }))
        return { added: games.length, unmatched, rated }
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
            return { games, predictions: predictWithCtx(games, s.teams, s.pitchers, s.bullpens) }
          })
        } catch {
          errors.push('No se pudo conectar con MLB Stats API')
        }
        return { updated, errors }
      },

      syncPitchers: async () => {
        try {
          const { games, teams, pitchers, bullpens } = get()
          if (!games.some((g) => g.id.startsWith('MLB'))) {
            return { rated: 0, patched: 0, errors: ['Primero sincroniza el calendario oficial (pestaña Calendario → “Sincronizar calendario oficial”).'] }
          }

          // Los abridores probables se anuncian a diario y solo ~5 días antes.
          // Refrescamos la ventana próxima y parchamos los IDs sobre los juegos ya
          // guardados (por su gamePk oficial), sin re-sincronizar toda la temporada.
          const season = new Date(SEASON_START).getFullYear()
          const today = new Date().toISOString().slice(0, 10)
          const in14 = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10)
          const events = await fetchMlbSchedule(today, in14, season)

          const byGame = new Map(events.map((ev) => [`MLB${ev.gamePk}`, ev]))
          let patched = 0
          const newGames = games.map((g) => {
            const ev = byGame.get(g.id)
            if (!ev) return g
            const homePitcherId = ev.homePitcherId ?? g.homePitcherId
            const awayPitcherId = ev.awayPitcherId ?? g.awayPitcherId
            if (homePitcherId !== g.homePitcherId || awayPitcherId !== g.awayPitcherId) patched++
            return { ...g, homePitcherId, awayPitcherId }
          })

          const ids = new Set<string>()
          for (const g of newGames) {
            if (g.played) continue
            if (g.homePitcherId) ids.add(g.homePitcherId)
            if (g.awayPitcherId) ids.add(g.awayPitcherId)
          }
          if (ids.size === 0) {
            return { rated: 0, patched, errors: ['Aún no hay abridores probables anunciados para los próximos juegos (MLB los publica ~5 días antes).'] }
          }

          const fresh = await fetchPitcherRatings([...ids], season)
          const merged = { ...pitchers, ...fresh }
          let mergedBull = bullpens
          try { mergedBull = { ...bullpens, ...(await fetchBullpenFactors(season, buildNameToId(TEAMS))) } } catch { /* opcional */ }
          set({ games: newGames, pitchers: merged, bullpens: mergedBull, predictions: predictWithCtx(newGames, teams, merged, mergedBull) })
          return { rated: Object.keys(fresh).length, patched, errors: [] }
        } catch {
          return { rated: 0, patched: 0, errors: ['No se pudieron obtener los abridores desde MLB Stats API'] }
        }
      },

      syncLines: async () => {
        try {
          const { games, teams, pitchers, bullpens } = get()
          const today = new Date().toISOString().slice(0, 10)
          // ESPN publica las líneas ~1 día antes; tomamos las fechas próximas con juegos pendientes.
          const dates = [...new Set(games.filter((g) => !g.played && g.date >= today).map((g) => g.date))].sort().slice(0, 4)
          if (dates.length === 0) return { updated: 0, errors: [] }

          const lines = await fetchMarketLines(dates)
          if (Object.keys(lines).length === 0) return { updated: 0, errors: [] }

          let updated = 0
          const newGames = games.map((g) => {
            const l = lines[`${g.date}|${g.awayId}|${g.homeId}`]
            if (!l) return g
            const runLine = l.total ?? g.runLine
            const mlHome = l.mlHome ?? g.mlHome
            const mlAway = l.mlAway ?? g.mlAway
            if (runLine !== g.runLine || mlHome !== g.mlHome || mlAway !== g.mlAway) {
              updated++
              return { ...g, runLine, mlHome, mlAway }
            }
            return g
          })
          if (updated === 0) return { updated: 0, errors: [] }
          set({ games: newGames, predictions: predictWithCtx(newGames, teams, pitchers, bullpens) })
          return { updated, errors: [] }
        } catch {
          return { updated: 0, errors: ['No se pudieron obtener las líneas (ESPN)'] }
        }
      },

      calibrateFromHistory: async () => {
        try {
          const hist = await loadHistoricalGames()
          if (hist.length < 200) {
            return { games: hist.length, brier: null, teamsUpdated: 0, errors: ['Historial insuficiente: coloca ≥200 juegos en /public/history.csv (ver HISTORY_DATA.md).'] }
          }

          const { teams, games, pitchers, bullpens } = get()
          const seedFallback = Object.fromEntries(
            Object.values(teams).map((t) => [t.id, { attack: t.attack, defense: t.defense }]),
          )
          const refDate = new Date().toISOString().slice(0, 10)

          // Grid-search: busca los hiperparámetros que MINIMIZAN el Brier de
          // holdout (15% final no visto). Es el modelo óptimo dado tus datos, en
          // vez de parámetros fijados a mano.
          const grid = cartesianGrid({
            homeAdv:  [0.06, 0.10, 0.14],
            xi:       [0.001, 0.002, 0.004],
            tauPrior: [10, 20, 40],
          })
          const gs = gridSearchHoldout(hist, grid, maherFactory(seedFallback, refDate), 0.85)
          const best = {
            xi:       gs.best.xi       ?? DEFAULT_MAHER_PARAMS.xi,
            tauPrior: gs.best.tauPrior ?? DEFAULT_MAHER_PARAMS.tauPrior,
            homeAdv:  gs.best.homeAdv  ?? DEFAULT_MAHER_PARAMS.homeAdv,
          }

          // Ratings Maher (log-espacio) con los MEJORES parámetros → ataque/defensa
          // lineal del store (attack = e^α, defense = e^β). Con la forma-producto de
          // computeLambdas esto reproduce el modelo Maher calibrado con datos reales.
          const ratings = estimateRatings(hist, { ...best, refDate }, seedFallback)
          const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
          const round2 = (x: number) => Math.round(x * 100) / 100

          const newTeams = { ...teams }
          let teamsUpdated = 0
          for (const [id, r] of Object.entries(ratings)) {
            if (!newTeams[id]) continue
            newTeams[id] = {
              ...newTeams[id],
              attack: round2(clamp(Math.exp(r.attack), 0.3, 2.5)),
              defense: round2(clamp(Math.exp(r.defense), 0.3, 2.0)),
            }
            teamsUpdated++
          }

          set({ teams: newTeams, predictions: predictWithCtx(games, newTeams, pitchers, bullpens) })
          return { games: hist.length, brier: Number.isFinite(gs.bestBrier) ? gs.bestBrier : null, teamsUpdated, errors: [] }
        } catch {
          return { games: 0, brier: null, teamsUpdated: 0, errors: ['Error al calibrar desde el historial'] }
        }
      },

      exportJSON: () => {
        const { teams, games, odds, pitchers, bullpens, postseasonSeries, postseasonSeeds, valueThreshold, kellyFraction } = get()
        return JSON.stringify({ teams, games, odds, pitchers, bullpens, postseasonSeries, postseasonSeeds, valueThreshold, kellyFraction }, null, 2)
      },

      importJSON: (json) => {
        try {
          const data = JSON.parse(json)
          const teams: Record<string, Team> = data.teams ?? buildInitialTeams()
          const games: Game[] = data.games ?? buildInitialGames()
          const pitchers: Record<string, PitcherRating> = data.pitchers ?? {}
          const bullpens: Record<string, number> = data.bullpens ?? {}
          set({
            teams,
            games,
            odds: data.odds ?? {},
            pitchers,
            bullpens,
            postseasonSeries: data.postseasonSeries ?? [],
            postseasonSeeds: data.postseasonSeeds ?? null,
            valueThreshold: data.valueThreshold ?? 0.03,
            kellyFraction: data.kellyFraction ?? 0.5,
            predictions: predictWithCtx(games, teams, pitchers, bullpens),
          })
        } catch {
          console.error('Error al importar JSON')
        }
      },

      resetToSeed: () => {
        const teams = buildInitialTeams()
        const games = buildInitialGames()
        set({
          teams, games, odds: {}, pitchers: {}, bullpens: {}, postseasonSeries: [], postseasonSeeds: null,
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
        pitchers: s.pitchers,
        bullpens: s.bullpens,
        postseasonSeries: s.postseasonSeries,
        postseasonSeeds: s.postseasonSeeds,
        valueThreshold: s.valueThreshold,
        kellyFraction: s.kellyFraction,
        scheduleSource: s.scheduleSource,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) state.predictions = predictWithCtx(state.games, state.teams, state.pitchers ?? {}, state.bullpens ?? {})
      },
    },
  ),
)

// Exportado para uso en Monte Carlo desde las páginas (evita recomputar wins ahí).
export { currentWinsByTeam }
