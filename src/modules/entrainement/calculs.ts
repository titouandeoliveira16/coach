/** Calculs du module Entraînement (fonctions pures, sans affichage). */

/** Pourcentages de VMA affichés dans le tableau d'allures. */
export const POURCENTAGES_VMA = [60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110]

/** Vitesse (km/h) → allure en secondes par km */
export const allureSecParKm = (kmh: number) => 3600 / kmh

/** Temps (secondes) pour parcourir une distance (m) à une vitesse (km/h) */
export const tempsSec = (distanceM: number, kmh: number) => (distanceM / 1000 / kmh) * 3600

/** Un effort maximal du test CP : sa durée et la puissance moyenne tenue. */
export interface EffortTest {
  dureeSec: number
  puissanceW: number
}

/**
 * Modèle de puissance critique à 2 paramètres (Monod & Scherrer, Moritani) :
 * le travail total W = P × t suit une droite W = CP × t + W′.
 * Une régression linéaire sur les efforts du test donne :
 *  - la pente = CP (W)
 *  - l'ordonnée à l'origine = W′ (J)
 *  - R² : qualité de l'ajustement (proche de 1 = test cohérent)
 * Il faut au moins 2 efforts de durées différentes.
 */
export function calculerCP(efforts: EffortTest[]) {
  if (efforts.length < 2) return undefined
  const x = efforts.map((e) => e.dureeSec)
  const y = efforts.map((e) => e.dureeSec * e.puissanceW)
  const n = efforts.length
  const mx = x.reduce((a, b) => a + b) / n
  const my = y.reduce((a, b) => a + b) / n
  const sxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0)
  if (sxx === 0) return undefined
  const sxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0)
  const cp = sxy / sxx
  const wPrime = my - cp * mx
  const syy = y.reduce((s, yi) => s + (yi - my) ** 2, 0)
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { cpW: cp, wPrimeKj: wPrime / 1000, r2 }
}
