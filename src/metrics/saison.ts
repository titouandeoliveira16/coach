import type { Phase } from './programme'
import { decaler } from './vfc'

/**
 * Saison calculée à l'envers depuis la course principale. Forme de l'entraîneur Mathias Chauvin, contenu relu par la
 * science (6/11/2026) : l'ordre des blocs change peu les progrès à charge égale (Sylta 2016), on suit donc le sien.
 * reprise (base d'endurance) → tirer le seuil → allonger le seuil → fin de prépa (sweet spot + VO2, 3 sem.) →
 * proche de la course (3 sem.) → affûtage (1-2 sem. : volume en baisse, intensité gardée, Bosquet 2007) →
 * récupération (1 sem.) → entretien.
 *  - Reprise (sans intensité) : 2 semaines, 4 pour un débutant ou après un arrêt de 4 semaines ou plus.
 *  - Base (relecture du 10/11/2026) : quand la course est loin, 4 à 10 semaines d'endurance avec 1 rappel d'intensité
 *    par semaine (la VO2max s'entretient avec l'intensité : Hickson 1985, Rønnestad 2014) au lieu d'une longue reprise.
 *  - Tirer le seuil : 40 % du temps restant, 4 semaines au plus ; allonger le seuil : le reste, 8 semaines au plus ;
 *    au-delà, de l'entretien juste après la reprise.
 *  - Tests CP : 1re semaine, puis au début des blocs, 5 à 8 semaines d'écart ; test court au début de « allonger le
 *    seuil » (il donne la nouvelle CP) ; jamais en affûtage.
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
  const d = { reprise: 0, base: 0, entretien: 0, 'seuil-tirage': 0, 'seuil-maintien': 0, 'fin-prepa': 0, specifique: 0, affutage: 0 }
  if (n <= 0) return d
  if (n < 3) return { ...d, affutage: n }
  d.affutage = n >= 6 ? 2 : 1
  let reste = n - d.affutage
  d.specifique = Math.min(3, reste)
  reste -= d.specifique
  d['fin-prepa'] = Math.min(3, reste)
  reste -= d['fin-prepa']
  d.reprise = Math.min(reste, repriseLongue ? 4 : 2)
  reste -= d.reprise
  // Beaucoup de temps : une base (endurance + 1 rappel d'intensité par semaine), jusqu'à 10 semaines
  d.base = Math.min(10, Math.max(0, reste - 12))
  reste -= d.base
  d['seuil-tirage'] = Math.min(4, Math.ceil(reste * 0.4))
  d['seuil-maintien'] = Math.min(8, reste - d['seuil-tirage'])
  d.entretien = reste - d['seuil-tirage'] - d['seuil-maintien']
  return d
}

export function calculerSaison(e: EntreeSaison) {
  const l0 = lundiDe(e.debut)
  const lc = lundiDe(e.course)
  const n = semainesEntre(l0, lc) + 1
  const d = dureesPhases(n, (e.arretSemaines ?? 0) >= 4 || !!e.debutant)
  const phases: Phase[] = []
  let l = l0
  for (const type of ['reprise', 'base', 'entretien', 'seuil-tirage', 'seuil-maintien', 'fin-prepa', 'specifique', 'affutage'] as const) {
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
  for (const ph of phases.filter((p) => p.type === 'seuil-tirage' || p.type === 'seuil-maintien' || p.type === 'fin-prepa' || p.type === 'specifique' || p.type === 'entretien' || p.type === 'base')) {
    if (ph.debut >= lc) break
    // Phase longue sans test depuis plus de 8 semaines : un test au milieu
    while (semainesEntre(dernier, ph.debut) > 8) {
      dernier = decaler(dernier, 56)
      ajouter(dernier, false)
    }
    if (ph.type !== 'entretien' && ph.type !== 'base' && semainesEntre(dernier, ph.debut) >= 5) {
      // Test court au début de « allonger le seuil » (nouvelle CP) ou quand la phase dure moins de 4 semaines
      ajouter(ph.debut, ph.type === 'seuil-maintien' || d[ph.type as 'seuil-tirage' | 'fin-prepa' | 'specifique'] < 4)
      dernier = ph.debut
    }
  }
  return { phases, testsCp: [...new Set(testsCp)].sort(), testsCourts, semaines: n }
}

/**
 * Saisons calculées avant le 10/11/2026 : une reprise de plus de 4 semaines (course loin) devient 2 semaines de
 * reprise puis une base (endurance + 1 rappel d'intensité par semaine).
 */
export function migrerBase(phases: Phase[]): Phase[] {
  const triees = [...phases].sort((a, b) => a.debut.localeCompare(b.debut))
  const i = triees.findIndex((p) => p.type === 'reprise')
  if (i < 0 || triees.some((p) => p.type === 'base')) return phases
  const suivante = triees[i + 1]
  if (!suivante || semainesEntre(triees[i].debut, suivante.debut) <= 4) return phases
  return [...triees.slice(0, i + 1), { debut: decaler(triees[i].debut, 14), type: 'base' }, ...triees.slice(i + 1)]
}
