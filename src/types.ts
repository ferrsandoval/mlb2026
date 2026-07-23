// Tipos centrales — Team y Game viven en data/seed.ts (fuente de verdad)
export type { Team, Game, League, Division, DivisionKey } from './data/seed'

// ─── Motor estadístico ──────────────────────────────────────────────────────

export interface GamePrediction {
  gameId: string
  homeId: string
  awayId: string
  lambdaHome: number
  lambdaAway: number
  probHome: number
  probAway: number
  probOver: number
  probUnder: number
  runLine: number
  probHomeMinus15: number
  probAwayPlus15: number
  topScorelines: Scoreline[]
}

export interface Scoreline {
  home: number
  away: number
  prob: number
}

// ─── Comparador de valor (moneyline, sin empate) ───────────────────────────

export interface OddsInput {
  home: number | null
  away: number | null
}

export interface ValueAnalysis {
  overround: number
  markets: {
    home: MarketValue
    away: MarketValue
  }
}

export interface MarketValue {
  impliedRaw: number
  impliedFair: number
  modelProb: number
  edge: number
  kelly: number
  halfKelly: number
  hasValue: boolean
}
