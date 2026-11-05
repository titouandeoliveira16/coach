import type { Phase } from './programme'
import { decaler } from './vfc'

/**
 * Saison calculée à l'envers depuis la course principale (relecteur scientifique du 5/11/2026) :
 * reprise → (entretien si beaucoup de temps) → VO2 → seuil → proche de la course (3 sem.) → affûtage (2 sem.)
 * → récupération (1 sem.) → entretien.
 *  - Affûtage : 2 semaines (1 si moins de 6 semaines) ; volume −35 puis −55 %, intensité gardée (Bosquet 2007).
 *  - Ordre VO2 puis seuil : il change peu de chose à charge égale (Sylta 2016) ; c'est celui de Titouan.
 *  - Reprise : 2 semaines au moins, plus longue s'il y a beaucoup de temps (jusqu'à 8), 4 au moins après un arrêt
 *    de 4 semaines ou plus ou pour un débutant (la forme baisse après 2 à 4 semaines d'arrêt).
 *  - Tests CP : 1re semaine, puis au début du VO2, du seuil et de la phase proche de la course ; 5 à 8 semaines entre
 *    deux tests ; jamais en affûtage ; test court 3' + 12' si la phase dure moins de 4 semaines.
 * Les durées exactes sont des choix d'entraîneur.
 */
export interface EntreeSaison {
  /** Date de début (le lundi de cette semaine est le début de la saison) */
  debut: string
  /** Date de la course principale */
  course: string
  /** Semaines sans vélo juste avant (0 si aucune) */
  arretSemaines?: number
  debutant?: boolean
  /** Jour de la sortie longue (tests complets) et de la séance dure (tests courts) : 0 = lundi … 6 = dimanche */
  jourLong?: number
  jourDur?: number
  /** Aujourd'hui (un test déjà passé glisse d'une semaine) */
  aujourdhui?: string
}

const lundiDe = (d: string) => decaler(d, -((new Date(`${d}T12:00:00`).getDay() + 6) % 7))
const semainesEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / (7 * 86_400_000))

/** Durée de chaque phase (en semaines) selon le nombre de semaines jusqu'à la course, semaine de course comprise. */
export function dureesPhases(n: number, repriseLongue = false) {
  if (n <= 0) return { reprise: 0, entretien: 0, vo2: 0, seuil: 0, specifique: 0, affutage: 0 }
  if (n < 3) return { reprise: 0, entretien: 0, vo2: 0, seuil: 0, specifique: 0, affutage: n }
  const affutage = n >= 6 ? 2 : 1
  if (n < 12) {
    const reprise = repriseLongue ? 1 : 0
    return { reprise, entretien: 0, vo2: 0, seuil: 0, specifique: n - affutage - reprise, affutage }
  }
  const specifique = 3
  const m = n - affutage - specifique
  let reprise = Math.min(8, Math.max(2, m - 16))
  if (repriseLongue) reprise = Math.max(reprise, Math.min(4, m))
  const reste = m - reprise
  const vo2 = Math.min(8, Math.ceil(reste / 2))
  const seuil = Math.min(8, reste - vo2)
  return { reprise, entretien: reste - vo2 - seuil, vo2, seuil, specifique, affutage }
}

export function calculerSaison(e: EntreeSaison) {
  const l0 = lundiDe(e.debut)
  const lc = lundiDe(e.course)
  const n = semainesEntre(l0, lc) + 1
  const d = dureesPhases(n, (e.arretSemaines ?? 0) >= 4 || !!e.debutant)
  const phases: Phase[] = []
  let l = l0
  for (const type of ['reprise', 'entretien', 'vo2', 'seuil', 'specifique', 'affutage'] as const) {
    if (d[type] > 0) phases.push({ debut: l, type })
    l = decaler(l, 7 * d[type])
  }
  phases.push({ debut: decaler(lc, 7), type: 'recuperation' }, { debut: decaler(lc, 14), type: 'entretien' })

  // Tests CP
  const jourLong = e.jourLong ?? 6
  const jourDur = e.jourDur ?? 1
  const testsCp: string[] = []
  const testsCourts: string[] = []
  const ajouter = (lundi: string, court: boolean) => {
    let date = decaler(lundi, court ? jourDur : jourLong)
    if (e.aujourdhui && date < e.aujourdhui) date = decaler(date, 7)
    if (date >= lc) return
    testsCp.push(date)
    if (court) testsCourts.push(date)
  }
  if (n >= 3) ajouter(l0, false)
  let dernier = l0
  for (const ph of phases.filter((p) => p.type === 'vo2' || p.type === 'seuil' || p.type === 'specifique' || p.type === 'entretien')) {
    if (ph.debut >= lc) break
    // Phase longue sans test depuis plus de 8 semaines : un test au milieu
    while (semainesEntre(dernier, ph.debut) > 8) {
      dernier = decaler(dernier, 56)
      ajouter(dernier, false)
    }
    if (ph.type !== 'entretien' && semainesEntre(dernier, ph.debut) >= 5) {
      ajouter(ph.debut, d[ph.type as 'vo2' | 'seuil' | 'specifique'] < 4)
      dernier = ph.debut
    }
  }
  return { phases, testsCp: [...new Set(testsCp)].sort(), testsCourts, semaines: n }
}
