// =============================================================================
// modelConfig.ts — Parámetros configurables del modelo estadístico
// =============================================================================

export interface ModelConfig {
  /**
   * Tasa de decaimiento temporal del peso de cada juego histórico (ratings Maher).
   * w = exp(-xi × díasDesdeRefDate). Rango: [0.0005, 0.01] días⁻¹. Default: 0.002.
   */
  xi: number

  /**
   * Fuerza del prior L2 sobre los ratings Maher (shrinkage hacia la media).
   * Rango: [0 (off), 100 (fuerte)]. Default: 20.
   */
  tauPrior: number

  /**
   * Ventaja de localía en escala log-carreras para el equipo local.
   * e^0.10 ≈ 1.10 → el local anota ~10% más carreras esperadas.
   * Rango: [0, 0.25]. Default: 0.10.
   */
  homeAdv: number

  /**
   * Número de simulaciones por corrida de Monte Carlo (temporada + postemporada).
   * Rango: [500, 20 000]. Default: 2 000 (una temporada completa de 2430 juegos
   * por simulación es mucho más costosa que un torneo corto de 72).
   */
  monteCarloN: number
}

export const DEFAULT_MODEL_CONFIG: ModelConfig = {
  xi:           0.002,
  tauPrior:     20,
  homeAdv:      0.10,
  monteCarloN:  2_000,
}
