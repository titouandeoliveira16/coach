/**
 * Calculateur de col : vitesse en montée par la physique, puissance tenable par le modèle de la puissance critique.
 * Valeurs moyennes d'un cycliste sur route : Crr 0,004 (bon bitume), CdA 0,35 m² (mains en haut du cintre),
 * air 1,15 kg/m³ (un peu d'altitude), transmission 97,5 %. Ce sont des estimations : vent et revêtement changent tout.
 */
const G = 9.81
const CRR = 0.004
const CDA = 0.35
const RHO = 1.15
const RENDEMENT = 0.975

/** Vitesse (m/s) à puissance constante sur une pente (fraction : 0,08 = 8 %), masse totale cycliste + vélo (kg). */
export function vitesseMontee(puissanceW: number, masseKg: number, pente: number) {
  const theta = Math.atan(pente)
  const resistance = masseKg * G * (Math.sin(theta) + CRR * Math.cos(theta))
  const besoin = (v: number) => v * resistance + 0.5 * RHO * CDA * v ** 3
  let bas = 0
  let haut = 30
  for (let i = 0; i < 60; i++) {
    const v = (bas + haut) / 2
    if (besoin(v) > puissanceW * RENDEMENT) haut = v
    else bas = v
  }
  return (bas + haut) / 2
}

/** Temps limite (s) à une puissance au-dessus de la CP : W′ / (P − CP). Undefined sous la CP (effort stable). */
export function tempsLimite(puissanceW: number, cpW: number, wPrimeKj: number) {
  return puissanceW > cpW ? (wPrimeKj * 1000) / (puissanceW - cpW) : undefined
}

/**
 * Puissance tenable (W) pendant une durée (s) : CP + W′/t jusqu'à 20 min (Jones 2010, 2019),
 * puis baisse progressive (loi de puissance, exposant −0,08 : la CP ne se tient que 20 à 30 min).
 */
export function puissanceTenable(dureeSec: number, cpW: number, wPrimeKj: number) {
  const t = Math.max(dureeSec, 120)
  if (t <= 1200) return cpW + (wPrimeKj * 1000) / t
  return (cpW + (wPrimeKj * 1000) / 1200) * (t / 1200) ** -0.08
}

/** Montée à puissance fixée : temps (s) et vitesse (km/h). */
export function montee(distanceKm: number, deniveleM: number, masseKg: number, puissanceW: number) {
  const v = vitesseMontee(puissanceW, masseKg, deniveleM / (distanceKm * 1000))
  return { tempsSec: (distanceKm * 1000) / v, kmh: v * 3.6 }
}

/** Montée à fond, bien dosée : la durée où « puissance tenable » et « temps de montée » se rejoignent. */
export function monteeAFond(distanceKm: number, deniveleM: number, masseKg: number, cpW: number, wPrimeKj: number) {
  let bas = 60
  let haut = 6 * 3600
  for (let i = 0; i < 60; i++) {
    const t = (bas + haut) / 2
    if (montee(distanceKm, deniveleM, masseKg, puissanceTenable(t, cpW, wPrimeKj)).tempsSec > t) bas = t
    else haut = t
  }
  const t = (bas + haut) / 2
  const w = puissanceTenable(t, cpW, wPrimeKj)
  return { puissanceW: Math.round(w), ...montee(distanceKm, deniveleM, masseKg, w) }
}
