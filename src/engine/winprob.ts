// =============================================================================
// winprob.ts — Probabilidad de victoria nativa de béisbol: Pythagenpat + log5
// -----------------------------------------------------------------------------
// Métodos sabermétricos clásicos, específicos de béisbol:
//
//  • Pythagorean (Bill James): el % de victorias esperado de un equipo se explica
//    mejor por sus carreras A FAVOR y EN CONTRA que por su récord real —
//    W% = RF^x / (RF^x + RC^x). Predice el récord FUTURO mejor que el récord
//    actual (que arrastra suerte en juegos cerrados).
//
//  • Pythagenpat: el exponente x no es fijo (1.83) sino que depende del entorno
//    de carreras del propio equipo — x = (carreras totales por juego)^0.287.
//    Es la variante más precisa (Smyth/Patriot).
//
//  • log5 (Bill James): combina dos % de victoria (vs. promedio de liga) en la
//    probabilidad de que A le gane a B en un enfrentamiento directo.
//
// Uso en esta app: proyección de posiciones/carrera de comodín a partir del
// diferencial de carreras real acumulado (ver standings.ts). Es una señal
// independiente y de bajo ruido para el récord final; NO se mezcla en el
// moneyline por juego, donde el Elo (que ya incorpora margen de victoria) y la
// matriz de marcador Binomial Negativa son la referencia.
// =============================================================================

/** % de victorias esperado (Pythagorean) con exponente dado. */
export function pythagoreanExpectation(runsFor: number, runsAgainst: number, exponent: number): number {
  if (runsFor <= 0 && runsAgainst <= 0) return 0.5
  const rf = Math.pow(Math.max(0, runsFor), exponent)
  const ra = Math.pow(Math.max(0, runsAgainst), exponent)
  const denom = rf + ra
  return denom > 0 ? rf / denom : 0.5
}

/** Exponente Pythagenpat: (carreras totales por juego)^0.287. */
export function pythagenpatExponent(runsForPerGame: number, runsAgainstPerGame: number): number {
  const rpg = Math.max(0.5, runsForPerGame + runsAgainstPerGame)
  return Math.pow(rpg, 0.287)
}

/**
 * % de victorias esperado (Pythagenpat) a partir de totales acumulados.
 * @param games  juegos jugados, para normalizar el entorno de carreras del exponente.
 */
export function pythagenpatWinPct(runsFor: number, runsAgainst: number, games: number): number {
  if (games <= 0) return 0.5
  const x = pythagenpatExponent(runsFor / games, runsAgainst / games)
  return pythagoreanExpectation(runsFor, runsAgainst, x)
}

/**
 * log5 — P(A vence a B) dadas sus tasas de victoria pA, pB frente al promedio
 * de liga (.500). Sin ventaja de localía.
 */
export function log5(pA: number, pB: number): number {
  const num = pA - pA * pB
  const den = pA + pB - 2 * pA * pB
  if (den <= 0) return 0.5
  return Math.min(1, Math.max(0, num / den))
}

/** log5 con un empujón aditivo de localía (hfa ≈ 0.035–0.04 en MLB moderna). */
export function log5HomeField(pHome: number, pAway: number, hfa = 0.035): number {
  return Math.min(1, Math.max(0, log5(pHome, pAway) + hfa))
}
