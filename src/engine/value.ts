// =============================================================================
// value.ts — Comparador de valor: cuotas moneyline (sin empate) → edge → Kelly
// =============================================================================

import type { OddsInput, ValueAnalysis, MarketValue } from '../types'

export const DEFAULT_VALUE_THRESHOLD = 0.03
export const DEFAULT_KELLY_FRACTION  = 0.5

export function impliedProb(odd: number): number {
  if (odd <= 1) return 1
  return 1 / odd
}

export function kellyFraction(odd: number, modelProb: number): number {
  const b = odd - 1
  if (b <= 0) return 0
  const q = 1 - modelProb
  const f = (b * modelProb - q) / b
  return Math.max(0, f)
}

export function analyzeValue(
  odds: OddsInput,
  modelProbs: { home: number; away: number },
  valueThreshold = DEFAULT_VALUE_THRESHOLD,
  kellyMult = DEFAULT_KELLY_FRACTION,
): ValueAnalysis | null {
  const { home: oHome, away: oAway } = odds
  if (!oHome || !oAway || oHome <= 1 || oAway <= 1) return null

  const rawHome = impliedProb(oHome)
  const rawAway = impliedProb(oAway)
  const overround = rawHome + rawAway

  const buildMarket = (odd: number, rawImplied: number, modelProb: number): MarketValue => {
    const impliedFair = rawImplied / overround
    const edge = modelProb - impliedFair
    const kelly = kellyFraction(odd, modelProb)
    return {
      impliedRaw: rawImplied,
      impliedFair,
      modelProb,
      edge,
      kelly,
      halfKelly: kelly * kellyMult,
      hasValue: edge > valueThreshold,
    }
  }

  return {
    overround,
    markets: {
      home: buildMarket(oHome, rawHome, modelProbs.home),
      away: buildMarket(oAway, rawAway, modelProbs.away),
    },
  }
}
