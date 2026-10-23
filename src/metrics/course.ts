/**
 * Course à pied : allure, % VMA, rTSS.
 * Allure seuil par défaut = 87 % de la VMA : la vitesse critique se situe en général
 * entre 85 et 90 % de la vVO2max chez le coureur entraîné (Jones & Vanhatalo, 2017).
 */

/** Vitesse (km/h) à partir d'une distance (km) et d'une durée (s). */
export const vitesseKmh = (distanceKm: number, dureeSec: number) => (distanceKm / dureeSec) * 3600

/** Allure en secondes par km. */
export const allureSecKm = (distanceKm: number, dureeSec: number) => dureeSec / distanceKm

/** Pourcentage de VMA. */
export const pctVma = (vitesse: number, vma: number) => (vitesse / vma) * 100

/** rTSS = heures × IF² × 100, avec IF = vitesse / vitesse seuil. 1 h au seuil = 100. */
export function rtss(dureeSec: number, vitesseKmhMoy: number, vmaKmh: number, seuilPct = 87) {
  const seuil = (vmaKmh * seuilPct) / 100
  const intensite = vitesseKmhMoy / seuil
  return (dureeSec / 3600) * intensite ** 2 * 100
}

/**
 * Allures « temps de maintien » (logique Campus Coach) à partir d'une course de référence.
 * Formule de Riegel (1981) : T2 = T1 × (D2 / D1)^1,06, donc la distance tenue pendant T vaut
 * D1 × (T / T1)^(1 / 1,06). Le seuil 60 est la vitesse tenable 60 min, le seuil 30 celle de 30 min,
 * la VMA celle d'environ 5 min (définition alternative de Campus).
 */
export const EXPOSANT_RIEGEL = 1.06

/** Vitesse (km/h) tenable pendant `dureeCibleSec`, prédite depuis une course (distance en m, temps en s). */
export function vitesseTenue(distanceM: number, tempsSec: number, dureeCibleSec: number) {
  const d = distanceM * (dureeCibleSec / tempsSec) ** (1 / EXPOSANT_RIEGEL)
  return (d / 1000 / dureeCibleSec) * 3600
}

/** Temps prédit (s) sur une distance (m), depuis une course de référence. */
export const tempsPredit = (distanceM: number, tempsSec: number, distanceCibleM: number) =>
  tempsSec * (distanceCibleM / distanceM) ** EXPOSANT_RIEGEL

export interface AlluresCourse {
  vmaKmh: number
  seuil30Kmh: number
  seuil60Kmh: number
}

export function alluresDepuisCourse(distanceM: number, tempsSec: number): AlluresCourse {
  return {
    vmaKmh: vitesseTenue(distanceM, tempsSec, 300),
    seuil30Kmh: vitesseTenue(distanceM, tempsSec, 1800),
    seuil60Kmh: vitesseTenue(distanceM, tempsSec, 3600),
  }
}
