/**
 * Puissance (vélo) : travail en kJ, puissance normalisée, TSS.
 * Références : Coggan & Allen, « Training and Racing with a Power Meter » (NP, IF, TSS).
 * Le seuil utilisé est la CP (puissance critique) : très proche de la FTP pour ces calculs.
 */

/** kJ = Σ watts × secondes / 1000 (les trous > 30 s sont ignorés). */
export function kjDepuisEchantillons(t: number[], w: (number | null)[]) {
  let joules = 0
  for (let i = 1; i < t.length; i++) {
    const dt = t[i] - t[i - 1]
    const p = w[i]
    if (p == null || dt <= 0 || dt > 30) continue
    joules += p * dt
  }
  return joules / 1000
}

/** kJ approchés = puissance moyenne × durée. */
export const kjDepuisMoyenne = (puissanceMoyW: number, dureeSec: number) => (puissanceMoyW * dureeSec) / 1000

/**
 * Puissance normalisée : moyenne glissante sur 30 s, élevée à la puissance 4,
 * moyennée, puis racine 4e. Les échantillons doivent être réguliers (1 par seconde).
 */
export function puissanceNormalisee(w1Hz: number[]) {
  if (w1Hz.length < 30) return undefined
  let somme = 0
  for (let i = 0; i < 30; i++) somme += w1Hz[i]
  let total4 = 0
  let n = 0
  for (let i = 29; i < w1Hz.length; i++) {
    if (i > 29) somme += w1Hz[i] - w1Hz[i - 30]
    total4 += (somme / 30) ** 4
    n++
  }
  return (total4 / n) ** 0.25
}

/** Rééchantillonne une série à 1 point par seconde (les trous sont remplis par 0 : roue libre / pause). */
export function reechantillonner1Hz(t: number[], v: (number | null)[]) {
  if (!t.length) return []
  const debut = t[0]
  const sortie = new Array<number>(Math.round(t[t.length - 1] - debut) + 1).fill(0)
  for (let i = 0; i < t.length; i++) sortie[Math.round(t[i] - debut)] = v[i] ?? 0
  return sortie
}

/** TSS = durée(s) × NP × IF / (seuil × 3600) × 100, avec IF = NP / seuil. */
export function tss(dureeSec: number, np: number, seuilW: number) {
  const intensite = np / seuilW
  return ((dureeSec * np * intensite) / (seuilW * 3600)) * 100
}
