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

