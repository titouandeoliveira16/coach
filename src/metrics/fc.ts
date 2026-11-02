/**
 * Fréquence cardiaque : temps par zone, domaines d'intensité, découplage.
 *
 * Domaines (modèle à 3 zones de Seiler, 2010, ancré sur la CP) : basse = sous le 1er seuil (Z1-Z2),
 * moyenne = du 1er seuil à la CP (Z3-Z4), haute = au-dessus de la CP (Z5). Les bornes de FC sont celles
 * des zones de puissance (Z4 s'arrête à la CP), recalées sur les sorties (calageFc).
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

/** Regroupe 5 zones en 3 domaines : basse (Z1+Z2), moyenne (Z3+Z4, jusqu'à la CP), haute (Z5). */
export const domaines = (zones: number[]) => ({
  basse: zones[0] + zones[1],
  moyenne: zones[2] + zones[3],
  haute: zones[4],
})

/** Domaine estimé d'une séance sans flux, à partir de sa FC moyenne. */
export function domaineDepuisFc(fcMoy: number, bornes: BornesZones): 'basse' | 'moyenne' | 'haute' {
  const z = zoneDe(fcMoy, bornes)
  return z <= 1 ? 'basse' : z <= 3 ? 'moyenne' : 'haute'
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

/**
 * Bornes de FC calées sur les sorties (relecture du 2/11 : choix d'entraîneur, aucune étude ne valide ce protocole précis) :
 *  - FC au 1er seuil = médiane, sur au moins 3 sorties stables (≥ 45 min, découplage < 5 %), de leur FC moyenne quand
 *    leur puissance moyenne est entre 65 et 75 % de la CP ;
 *  - FC à la CP = médiane de la FC de la dernière minute des blocs de 12 min ou plus faits à 95-100 % de la CP
 *    (au moins 2 séances : près de la CP, la FC monte encore 10 à 20 min) ;
 *  - Z2 s'arrête au 1er seuil, Z4 à la CP, Z3 à 90 % de la CP (interpolée : FC et puissance montent à peu près en ligne
 *    droite sous la CP). Z1 ne bouge pas.
 */
export function calageFc(o: {
  cpW: number
  bornes: BornesZones
  sorties: { fcMoy: number; puissanceMoyW: number; dureeSec: number; decouplage?: number }[]
  blocs: { w: number; fcFin: number; dureeSec: number; seance: string }[]
}) {
  const mediane = (x: number[]) => {
    const t = [...x].sort((a, b) => a - b)
    return t.length % 2 ? t[(t.length - 1) / 2] : (t[t.length / 2 - 1] + t[t.length / 2]) / 2
  }
  const stables = o.sorties.filter((s) => s.dureeSec >= 2700 && s.decouplage !== undefined && Math.abs(s.decouplage) < 5 &&
    s.puissanceMoyW >= 0.65 * o.cpW && s.puissanceMoyW <= 0.75 * o.cpW)
  const seuil = o.blocs.filter((b) => b.dureeSec >= 720 && b.w >= 0.95 * o.cpW && b.w <= 1.0 * o.cpW)
  if (stables.length < 3 || new Set(seuil.map((b) => b.seance)).size < 2) return undefined
  const fc1 = Math.round(mediane(stables.map((s) => s.fcMoy)))
  const fcCp = Math.round(mediane(seuil.map((b) => b.fcFin)))
  if (fcCp <= fc1 + 5) return undefined
  const fc90 = Math.round(fc1 + ((fcCp - fc1) * (0.9 - 0.7)) / (1 - 0.7))
  const bornes: BornesZones = [Math.min(o.bornes[0], fc1 - 1), fc1, fc90, fcCp]
  return { fc1, fcCp, bornes, nSorties: stables.length, nBlocs: seuil.length }
}
