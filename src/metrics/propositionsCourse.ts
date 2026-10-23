/**
 * Propositions de séances de course pour la semaine.
 * Principes :
 *  - distribution majoritairement en basse intensité (Seiler ; Stöggl & Sperlich, 2014) ;
 *  - progression du volume ≤ 10 % par semaine, semaine allégée (−25 %) toutes les 4 semaines ;
 *  - affûtage (−40 %) dans les 10 jours avant l'objectif (Bosquet et al., 2007) ;
 *  - une seule séance de qualité par semaine, jamais le lendemain ni la veille
 *    d'une séance vélo intense (charge totale).
 */
import { decaler } from './vfc'
import type { Intensite } from './planif'

export type ObjectifCourse = '5k' | '10k' | 'semi' | 'marathon' | 'entretien'

export interface ParamsCourse {
  objectif: ObjectifCourse
  dateObjectif?: string
  seancesParSemaine: number
  vmaKmh: number
  /** Les 7 dates de la semaine, du lundi au dimanche */
  semaine: string[]
  /** Minutes de course des 3 semaines précédentes */
  volumesPrecedentsMin: number[]
  /** Numéro de la semaine dans le bloc (1, 2, 3…) */
  numeroSemaine: number
  indispos: Set<string>
  /** Jours avec une séance vélo intense (prévue ou faite) */
  joursVeloIntense: Set<string>
}

export interface SeanceProposee {
  date: string
  titre: string
  intensite: Intensite
  dureeMin: number
  detail: string
  longue?: boolean
}

/** Allure en min/km pour un % de VMA, ex. "4'03". */
export function allurePct(vma: number, pct: number) {
  const secKm = 3600 / ((vma * pct) / 100)
  const m = Math.floor(secKm / 60)
  const s = Math.round(secKm % 60)
  return s === 60 ? `${m + 1}'00` : `${m}'${String(s).padStart(2, '0')}`
}

/** Volume cible de la semaine (minutes). */
export function volumeCible(p: Pick<ParamsCourse, 'volumesPrecedentsMin' | 'numeroSemaine' | 'dateObjectif' | 'semaine'>) {
  const precedents = p.volumesPrecedentsMin.filter((v) => v > 0)
  const base = precedents.length ? precedents.reduce((a, b) => a + b, 0) / precedents.length : 120
  let cible = base * 1.08 // progression ≤ 10 %
  if (p.numeroSemaine % 4 === 0) cible = base * 0.75 // semaine allégée
  if (p.dateObjectif && p.dateObjectif >= p.semaine[0] && p.dateObjectif <= decaler(p.semaine[6], 10)) cible = base * 0.6 // affûtage
  return Math.round(cible / 5) * 5
}

function seanceQualite(p: ParamsCourse): Omit<SeanceProposee, 'date'> {
  const v = p.vmaKmh
  const impaire = p.numeroSemaine % 2 === 1
  const longueDistance = p.objectif === 'semi' || p.objectif === 'marathon'
  if (longueDistance && !impaire) {
    const [a, b] = p.objectif === 'semi' ? [82, 85] : [75, 80]
    return {
      titre: `Allure ${p.objectif === 'semi' ? 'semi' : 'marathon'}`,
      intensite: 'moyenne',
      dureeMin: 60,
      detail: `15' échauffement · 3 × 12' à ${a}-${b} % VMA (${allurePct(v, b)}-${allurePct(v, a)}/km), récup 3' trot · 10' retour au calme`,
    }
  }
  if (impaire && !longueDistance) {
    return p.objectif === '10k'
      ? { titre: 'VMA longue', intensite: 'haute', dureeMin: 50, detail: `15' échauffement · 5 × 3' à 95 % VMA (${allurePct(v, 95)}/km), récup 2' trot · 10' retour au calme` }
      : { titre: 'VMA courte', intensite: 'haute', dureeMin: 45, detail: `15' échauffement · 2 × 8 × 30"/30" à 100-105 % VMA (${allurePct(v, 105)}-${allurePct(v, 100)}/km), 3' entre séries · 10' retour au calme` }
  }
  return {
    titre: 'Seuil',
    intensite: 'moyenne',
    dureeMin: 55,
    detail: `15' échauffement · 3 × 8' à 85-88 % VMA (${allurePct(v, 88)}-${allurePct(v, 85)}/km), récup 2' trot · 10' retour au calme`,
  }
}

/** Propose les séances de course de la semaine. */
export function proposerSemaineCourse(p: ParamsCourse): SeanceProposee[] {
  const n = Math.max(1, Math.min(6, p.seancesParSemaine))
  const volume = volumeCible(p)
  const libres = p.semaine.filter((d) => !p.indispos.has(d))
  const pris = new Set<string>()
  const res: SeanceProposee[] = []
  const footing = `65-75 % VMA (${allurePct(p.vmaKmh, 75)}-${allurePct(p.vmaKmh, 65)}/km), en aisance respiratoire`

  // 1. Sortie longue : dimanche, sinon samedi, sinon un autre jour libre
  let longueMin = 0
  if (n >= 2) {
    const jour = [p.semaine[6], p.semaine[5], ...libres].find((d) => libres.includes(d))
    if (jour) {
      longueMin = Math.min(120, Math.max(50, Math.round((volume * 0.3) / 5) * 5))
      res.push({ date: jour, titre: 'Sortie longue', intensite: 'basse', dureeMin: longueMin, detail: footing, longue: true })
      pris.add(jour)
    }
  }

  // 2. Qualité : mardi > mercredi > jeudi > autres ; pas à côté d'un vélo intense ni de la sortie longue
  const q = seanceQualite(p)
  const ordre = [1, 2, 3, 4, 0, 5, 6].map((i) => p.semaine[i])
  const voisinIntense = (d: string) =>
    [decaler(d, -1), d, decaler(d, 1)].some((x) => p.joursVeloIntense.has(x)) ||
    res.some((s) => s.longue && (s.date === decaler(d, 1) || s.date === decaler(d, -1)))
  const jourQ = ordre.find((d) => libres.includes(d) && !pris.has(d) && !voisinIntense(d))
  if (jourQ) {
    res.push({ date: jourQ, ...q })
    pris.add(jourQ)
  }

  // 3. Footings : le reste du volume, réparti sur des jours non adjacents si possible
  const nFooting = n - res.length
  if (nFooting > 0) {
    const reste = Math.max(30 * nFooting, volume - longueMin - (jourQ ? q.dureeMin : 0))
    const duree = Math.max(30, Math.round(reste / nFooting / 5) * 5)
    const adjacent = (d: string) => res.some((s) => s.date === decaler(d, 1) || s.date === decaler(d, -1))
    // De préférence : pas collé à une autre course, et pas un jour de vélo intense
    const cout = (d: string) => Number(adjacent(d)) + Number(p.joursVeloIntense.has(d))
    const candidats = libres
      .filter((d) => !pris.has(d))
      .sort((a, b) => cout(a) - cout(b))
    for (const d of candidats.slice(0, nFooting)) {
      res.push({ date: d, titre: 'Footing', intensite: 'basse', dureeMin: duree, detail: footing })
      pris.add(d)
    }
  }
  return res.sort((a, b) => a.date.localeCompare(b.date))
}
