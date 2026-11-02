/**
 * Couleurs des zones de puissance, comme sur Zwift : gris (récup), bleu (endurance), vert (tempo),
 * jaune (seuil), orange (VO2max), rouge (anaérobie), violet (à fond).
 * Bornes en % de la CP : < 55 · 56-75 · 76-90 · 91-100 · 101-120 · > 120 (la CP sépare l'effort stable de l'effort
 * qui épuise : Jones 2019, Poole 2016 ; relecture du 2/11).
 */
export const COULEURS_ZONES = ['#8b949e', '#3b9ce6', '#3fb950', '#f2c12e', '#f0883e', '#e5534b'] as const
export const COULEUR_A_FOND = '#a371f7'

export function couleurPctCP(pct: number | undefined) {
  if (pct === undefined) return COULEUR_A_FOND
  return COULEURS_ZONES[[55.5, 75.5, 90.5, 100.5, 120.5].filter((s) => pct >= s).length]
}

/** Course à pied, en % de la VMA. */
export function couleurPctVMA(pct: number) {
  return COULEURS_ZONES[[0, 72, 85, 92, 110].filter((s) => pct >= s).length]
}

/**
 * Zones de puissance en % de la CP, ancrées sur les domaines physiologiques (relecture du 2/11) :
 * modéré (Z1-Z2, sous ~75 % : limite prudente, 1er seuil vers 80 % en course, Hunter 2024),
 * lourd (Z3-Z4, jusqu'à la CP), sévère (Z5-Z6, au-dessus : la réserve W′ se vide).
 */
export const ZONES_PCT_CP: { nom: string; min: number; max?: number }[] = [
  { nom: 'Z1', min: 0, max: 55 }, { nom: 'Z2', min: 56, max: 75 }, { nom: 'Z3', min: 76, max: 90 },
  { nom: 'Z4', min: 91, max: 100 }, { nom: 'Z5', min: 101, max: 120 }, { nom: 'Z6', min: 121 },
]

/** Zones de puissance d'une CP ; les bornes de FC déjà réglées sont gardées zone par zone. */
export function zonesDepuisCp(cpW: number, anciennes: { fcMin?: number; fcMax?: number }[] = []) {
  return ZONES_PCT_CP.map((z, i) => ({
    nom: z.nom,
    wMin: Math.round((cpW * z.min) / 100),
    ...(z.max !== undefined ? { wMax: Math.round((cpW * z.max) / 100) } : {}),
    ...(anciennes[i]?.fcMin !== undefined ? { fcMin: anciennes[i].fcMin } : {}),
    ...(anciennes[i]?.fcMax !== undefined && z.max !== undefined ? { fcMax: anciennes[i].fcMax } : {}),
  }))
}
