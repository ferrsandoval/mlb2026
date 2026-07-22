// =============================================================================
// scoring.ts — Métricas de evaluación para predicciones moneyline (2 salidas)
// -----------------------------------------------------------------------------
// El béisbol no tiene empates, así que el mercado es binario [pHome, pAway].
// No se usa RPS (Ranked Probability Score): con solo 2 categorías, RPS es
// equivalente a la mitad del Brier Score y no aporta información adicional
// sobre penalizar "el extremo equivocado" (no existe una categoría intermedia).
// =============================================================================

/** Distribución de probabilidad moneyline: [pHome, pAway] */
export type Probs2 = [number, number]

/** Resultado observado: H = local gana, A = visitante gana */
export type GameResult = 'H' | 'A'

// ─── Brier Score ─────────────────────────────────────────────────────────────
//
// BS = (1/2) × Σ (p_k − o_k)²
// Rango: [0, 1]. Predicción perfecta → 0. Probs uniformes (0.5/0.5) → 0.25.

export function brier(probs: Probs2, result: GameResult): number {
  const observed: GameResult[] = ['H', 'A']
  let sum = 0
  for (let i = 0; i < 2; i++) {
    const o = observed[i] === result ? 1 : 0
    sum += (probs[i] - o) ** 2
  }
  return sum / 2
}

// ─── Log Loss ────────────────────────────────────────────────────────────────

const LOG_LOSS_EPS = 1e-15

export function logLoss(probs: Probs2, result: GameResult): number {
  const idx = result === 'H' ? 0 : 1
  return -Math.log(Math.max(probs[idx], LOG_LOSS_EPS))
}

// ─── Constantes de referencia ─────────────────────────────────────────────────

/** Brier Score de un predictor plano (50/50) */
export const FLAT_BRIER = 0.25

/** Log Loss de un predictor plano (50/50) */
export const FLAT_LOGLOSS = Math.log(2)
