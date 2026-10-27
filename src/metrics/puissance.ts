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

/** Meilleure puissance moyenne tenue pendant `dureeSec` (fenêtre glissante, signal à 1 Hz). */
export function meilleurePuissance(w1Hz: number[], dureeSec: number) {
  if (w1Hz.length < dureeSec) return undefined
  let somme = 0
  for (let i = 0; i < dureeSec; i++) somme += w1Hz[i]
  let max = somme
  for (let i = dureeSec; i < w1Hz.length; i++) {
    somme += w1Hz[i] - w1Hz[i - dureeSec]
    if (somme > max) max = somme
  }
  return max / dureeSec
}

/** Durées utilisées pour estimer la CP entre deux tests (Karsten 2015 : 3, 7 et 12 min). */
export const DUREES_CP = [180, 420, 720] as const
/** Durées de la courbe de puissance (de 1 s à 2 h, les mêmes que Garmin). */
export const DUREES_COURBE = [1, 2, 5, 10, 20, 30, 60, 120, 300, 600, 1200, 1800, 3600, 7200] as const
/** Meilleurs efforts gardés pour chaque séance : courbe de puissance + estimation de la CP. */
export const DUREES_MEILLEURS = [...new Set([...DUREES_COURBE, ...DUREES_CP])].sort((a, b) => a - b)

/** Meilleurs efforts d'une séance (watts arrondis), d'après la puissance à 1 Hz. */
export function meilleursEfforts(w1Hz: number[]) {
  const meilleurs: Record<string, number> = {}
  for (const d of DUREES_MEILLEURS) {
    const m = meilleurePuissance(w1Hz, d)
    if (m) meilleurs[d] = Math.round(m)
  }
  return meilleurs
}

/**
 * Watts moyens de chaque bloc de travail : on cherche dans la séance les `n` meilleurs passages de `dureeSec`
 * qui ne se chevauchent pas, puis on les remet dans l'ordre. Sert à comparer les blocs à la cible (seuil, sweet spot…).
 */
export function blocsDeTravail(w1Hz: number[], dureeSec: number, n: number): number[] | undefined {
  return reperesBlocs(w1Hz, dureeSec, n)?.map((b) => b.w)
}

/** Comme blocsDeTravail, avec le début (s) de chaque bloc. */
export function reperesBlocs(w1Hz: number[], dureeSec: number, n: number): { debut: number; w: number }[] | undefined {
  if (n < 1 || dureeSec < 30 || w1Hz.length < n * dureeSec) return undefined
  const prefixe = [0]
  for (const w of w1Hz) prefixe.push(prefixe[prefixe.length - 1] + w)
  const pris: number[] = []
  for (let k = 0; k < n; k++) {
    let meilleur = -1
    let debut = -1
    for (let i = 0; i + dureeSec <= w1Hz.length; i++) {
      if (pris.some((p) => i < p + dureeSec && p < i + dureeSec)) continue
      const m = prefixe[i + dureeSec] - prefixe[i]
      if (m > meilleur) {
        meilleur = m
        debut = i
      }
    }
    if (debut < 0) return undefined
    pris.push(debut)
  }
  return pris.sort((a, b) => a - b).map((i) => ({ debut: i, w: Math.round((prefixe[i + dureeSec] - prefixe[i]) / dureeSec) }))
}
