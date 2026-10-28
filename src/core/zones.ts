/**
 * Couleurs des zones de puissance, comme sur Zwift : gris (récup), bleu (endurance), vert (tempo),
 * jaune (seuil), orange (VO2max), rouge (anaérobie), violet (à fond).
 * Bornes en % de la CP (≈ FTP) : < 55 · 55-75 · 76-90 · 91-105 · 106-120 · > 120.
 */
export const COULEURS_ZONES = ['#8b949e', '#3b9ce6', '#3fb950', '#f2c12e', '#f0883e', '#e5534b'] as const
export const COULEUR_A_FOND = '#a371f7'

export function couleurPctCP(pct: number | undefined) {
  if (pct === undefined) return COULEUR_A_FOND
  return COULEURS_ZONES[[55, 76, 91, 106, 121].filter((s) => pct >= s).length]
}

/** Course à pied, en % de la VMA. */
export function couleurPctVMA(pct: number) {
  return COULEURS_ZONES[[0, 72, 85, 92, 110].filter((s) => pct >= s).length]
}
