/**
 * Charge d'entraînement : formules pures (aucun accès à la base), testées dans charge.test.ts.
 *
 * Références :
 *  - sRPE : Foster et al., 2001 (J Strength Cond Res) — RPE (CR-10) × durée (min).
 *  - TRIMP : Banister, 1991 — Σ Δt × x × 0,64 × e^(1,92·x), x = réserve de FC utilisée (homme).
 *  - CTL / ATL / TSB : modèle impulsion-réponse de Banister (1975), forme « Performance Manager »
 *    (constantes 42 j et 7 j, moyenne exponentielle de pas 1/N).
 *  - Monotonie et contrainte : Foster, 1998 (Med Sci Sports Exerc).
 *  - Ratio aigu/chronique (EWMA) : Williams et al., 2017 — affiché à titre indicatif seulement
 *    (Impellizzeri et al., 2020-2021 : faible valeur prédictive des blessures).
 */

/** sRPE (unités arbitraires) = RPE × durée en minutes. */
export const srpe = (rpe: number, dureeMin: number) => rpe * dureeMin

/** Part de la réserve de FC utilisée, bornée entre 0 et 1. */
export function reserveFc(fc: number, fcRepos: number, fcMax: number) {
  const x = (fc - fcRepos) / (fcMax - fcRepos)
  return Math.min(1, Math.max(0, x))
}

/** TRIMP d'une minute passée à la fraction x de la réserve de FC. */
export const trimpParMinute = (x: number) => x * 0.64 * Math.exp(1.92 * x)

/**
 * TRIMP de Banister à partir d'échantillons de FC.
 * @param t temps en secondes (croissant), @param fc FC à chaque instant (null = pas de mesure)
 * Les trous de plus de 30 s (pause) ne sont pas comptés.
 */
export function trimpBanister(t: number[], fc: (number | null)[], fcRepos: number, fcMax: number) {
  let total = 0
  for (let i = 1; i < t.length; i++) {
    const dt = t[i] - t[i - 1]
    const f = fc[i]
    if (f == null || dt <= 0 || dt > 30) continue
    total += (dt / 60) * trimpParMinute(reserveFc(f, fcRepos, fcMax))
  }
  return total
}

/** TRIMP approché à partir de la seule FC moyenne (saisie manuelle, sans flux). */
export const trimpDepuisMoyenne = (fcMoy: number, dureeMin: number, fcRepos: number, fcMax: number) =>
  dureeMin * trimpParMinute(reserveFc(fcMoy, fcRepos, fcMax))

/** Un point du modèle forme/fatigue. */
export interface PointForme {
  date: string
  charge: number
  /** Fitness : moyenne exponentielle sur 42 jours */
  ctl: number
  /** Fatigue : moyenne exponentielle sur 7 jours */
  atl: number
  /** Fraîcheur : CTL d'hier − ATL d'hier */
  tsb: number
}

/**
 * Calcule CTL / ATL / TSB jour par jour.
 * @param charges charge de chaque jour, dans l'ordre (jours sans séance = 0)
 */
export function modeleForme(charges: { date: string; charge: number }[], ctl0 = 0, atl0 = 0): PointForme[] {
  let ctl = ctl0
  let atl = atl0
  return charges.map(({ date, charge }) => {
    const tsb = ctl - atl // valeurs de la veille
    ctl += (charge - ctl) / 42
    atl += (charge - atl) / 7
    return { date, charge, ctl, atl, tsb }
  })
}

/** Moyenne et écart-type (population). */
export function moyenneEcartType(valeurs: number[]) {
  const n = valeurs.length
  if (!n) return { moyenne: 0, ecartType: 0 }
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / n
  const variance = valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / n
  return { moyenne, ecartType: Math.sqrt(variance) }
}

/**
 * Monotonie (Foster) = moyenne / écart-type des charges quotidiennes sur 7 jours.
 * Renvoie undefined si l'écart-type est nul (charge identique chaque jour).
 */
export function monotonie(charges7j: number[]) {
  const { moyenne, ecartType } = moyenneEcartType(charges7j)
  return ecartType === 0 ? undefined : moyenne / ecartType
}

/** Contrainte (Foster) = charge de la semaine × monotonie. */
export function contrainte(charges7j: number[]) {
  const m = monotonie(charges7j)
  return m === undefined ? undefined : charges7j.reduce((a, b) => a + b, 0) * m
}

/**
 * Pic de charge : charge des 7 derniers jours rapportée à la moyenne hebdomadaire
 * des 4 semaines précédentes (ta propre base). > 1,3 = hausse marquée.
 */
export function ratioPic(charge7j: number, chargesHebdoPrecedentes: number[]) {
  const base = chargesHebdoPrecedentes.length ? chargesHebdoPrecedentes.reduce((a, b) => a + b, 0) / chargesHebdoPrecedentes.length : 0
  return base > 0 ? charge7j / base : undefined
}
