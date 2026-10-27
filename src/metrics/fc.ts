/**
 * Fréquence cardiaque : temps par zone, domaines d'intensité, découplage.
 *
 * Domaines (modèle à 3 zones de Seiler, 2010) : basse = sous le 1er seuil (Z1-Z2),
 * moyenne = entre les seuils (Z3), haute = au-dessus du 2e seuil (Z4-Z5).
 * Découplage (« Pa:HR » / « Pw:HR ») : Friel ; < 5 % = bonne endurance aérobie.
 */

/** Bornes hautes (bpm) des zones 1 à 4 ; la zone 5 est au-dessus. */
export type BornesZones = [number, number, number, number]

/** Numéro de zone (0 à 4) pour une FC donnée. */
export function zoneDe(fc: number, bornes: BornesZones) {
  for (let i = 0; i < 4; i++) if (fc < bornes[i]) return i
  return 4
}

/** Secondes passées dans chaque zone (5 valeurs). Trous > 30 s ignorés. */
export function tempsParZone(t: number[], fc: (number | null)[], bornes: BornesZones) {
  const zones = [0, 0, 0, 0, 0]
  for (let i = 1; i < t.length; i++) {
    const dt = t[i] - t[i - 1]
    const f = fc[i]
    if (f == null || dt <= 0 || dt > 30) continue
    zones[zoneDe(f, bornes)] += dt
  }
  return zones
}

/** Regroupe 5 zones en 3 domaines : basse (Z1+Z2), moyenne (Z3), haute (Z4+Z5). */
export const domaines = (zones: number[]) => ({
  basse: zones[0] + zones[1],
  moyenne: zones[2],
  haute: zones[3] + zones[4],
})

/** Domaine estimé d'une séance sans flux, à partir de sa FC moyenne. */
export function domaineDepuisFc(fcMoy: number, bornes: BornesZones): 'basse' | 'moyenne' | 'haute' {
  const z = zoneDe(fcMoy, bornes)
  return z <= 1 ? 'basse' : z === 2 ? 'moyenne' : 'haute'
}

/**
 * Découplage cardiaque en % : (ratio 1re moitié − ratio 2de moitié) / ratio 1re moitié × 100,
 * où ratio = sortie moyenne (vitesse ou puissance) / FC moyenne. Seuls les points avec FC et sortie > 0 comptent.
 */
export function decouplage(t: number[], fc: (number | null)[], sortie: (number | null)[], ignorerDebutSec = 0) {
  const points: { t: number; fc: number; s: number }[] = []
  for (let i = 0; i < t.length; i++) {
    // L'échauffement (montée normale de la FC) ne compte pas : on mesure sur la partie stable
    if (t[i] - t[0] < ignorerDebutSec) continue
    const f = fc[i]
    const s = sortie[i]
    if (f != null && f > 0 && s != null && s > 0) points.push({ t: t[i], fc: f, s })
  }
  if (points.length < 20) return undefined
  const milieu = (points[0].t + points[points.length - 1].t) / 2
  const ratio = (p: typeof points) => p.reduce((a, x) => a + x.s, 0) / p.reduce((a, x) => a + x.fc, 0)
  const r1 = ratio(points.filter((p) => p.t < milieu))
  const r2 = ratio(points.filter((p) => p.t >= milieu))
  return ((r1 - r2) / r1) * 100
}

/** Secondes passées à une FC supérieure ou égale à `seuil` (FC échantillonnée à 1 Hz). */
export function tempsAuDessus(fc1Hz: number[], seuil: number) {
  return fc1Hz.reduce((n, f) => n + (f >= seuil ? 1 : 0), 0)
}

/**
 * Montée de la FC dans un bloc à effort constant (%) : FC moyenne du dernier quart
 * comparée à celle du 2e quart (le 1er quart est la montée normale en début d'effort).
 */
export function deriveDansBloc(fc1Hz: number[], debut: number, duree: number) {
  const q = Math.floor(duree / 4)
  const moy = (a: number, b: number) => {
    const l = fc1Hz.slice(a, b).filter((f) => f > 0)
    return l.length ? l.reduce((x, y) => x + y, 0) / l.length : undefined
  }
  const deuxieme = moy(debut + q, debut + 2 * q)
  const dernier = moy(debut + 3 * q, debut + duree)
  return deuxieme && dernier ? ((dernier - deuxieme) / deuxieme) * 100 : undefined
}
