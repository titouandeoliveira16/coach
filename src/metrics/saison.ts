import type { Phase } from './programme'
import { decaler } from './vfc'

/**
 * Saison calculée à l'envers depuis la course principale. Forme de l'entraîneur Mathias Chauvin, contenu relu par la
 * science (6/11/2026) : l'ordre des blocs change peu les progrès à charge égale (Sylta 2016), on suit donc le sien.
 * reprise (base d'endurance) → tirer le seuil → allonger le seuil → fin de prépa (sweet spot + VO2, 3 sem.) →
 * proche de la course (3 sem.) → affûtage (1-2 sem. : volume en baisse, intensité gardée, Bosquet 2007) →
 * récupération (1 sem.) → entretien.
 *  - Reprise (sans intensité) : selon la coupure, 0 (1 semaine ou moins), 1 (2-3), 2 (4-6) ou 4 (plus) ; 4 pour un
 *    débutant, 2 si tu ne roulais pas encore régulièrement.
 *  - Cycle 1er seuil (relu le 13/11/2026) : autant de semaines que le 2e seuil (4 à 10), 2 séances au 1er seuil par
 *    semaine (dédiée + blocs dans la sortie longue) et 1 rappel VO2 court (Rønnestad 2014 ; Spiering 2021).
 *  - 2e seuil : tirer (2 à 4 semaines) puis allonger le maintien, 10 semaines au plus ; au-delà, de l'entretien au début.
 *  - Reprise seulement après un vrai arrêt, moins les semaines déjà roulées depuis (13/11/2026).
 *  - Tests CP : 1re semaine, puis au début des blocs, 5 à 8 semaines d'écart ; test court au début de « allonger le
 *    seuil » (il donne la nouvelle CP) ; jamais en affûtage.
 * Les durées exactes sont des choix d'entraîneur.
 */
export interface EntreeSaison {
  /** Date de début (le lundi de cette semaine est le début de la saison) */
  debut: string
  /** Date de la course principale */
  course: string
  /** Tu roulais déjà régulièrement (4 dernières semaines importées) : pas de reprise */
  entraine?: boolean
  /** Semaines sans vélo juste avant (0 si aucune) */
  arretSemaines?: number
  /** Semaines déjà roulées régulièrement depuis la fin de l'arrêt : retirées de la reprise (13/11/2026) */
  repriseFaite?: number
  debutant?: boolean
  /** Jour de la sortie longue (tests complets) et de la séance dure (tests courts) : 0 = lundi … 6 = dimanche */
  jourLong?: number
  jourDur?: number
  /** Aujourd'hui (un test déjà passé glisse d'une semaine) */
  aujourdhui?: string
}

const lundiDe = (d: string) => decaler(d, -((new Date(`${d}T12:00:00`).getDay() + 6) % 7))
const semainesEntre = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / (7 * 86_400_000))

/**
 * Durée de chaque phase (en semaines) selon le nombre de semaines jusqu'à la course, semaine de course comprise.
 * Prépa hivernale de Methodic Cycling (cycles de 3 semaines + 1 allégée), relue le 10/11/2026 : l'ordre des blocs change
 * peu les progrès à charge égale (Sylta 2016) ; durées = choix d'entraîneur. En partant de la course : affûtage 2,
 * spécifique 3, cycle VO2max 3 ; puis le 2e seuil (tirée 2-4, poussée 2-8), le cycle 1er seuil (4-10), et au-delà de
 * l'entretien au début. Reprise : 0 si tu roulais déjà régulièrement, sinon 2 (4 en débutant ou après un arrêt).
 */
export function dureesPhases(n: number, repriseLongue = false, entraine = false, semainesReprise?: number) {
  const d = { reprise: 0, entretien: 0, base: 0, 'seuil-tirage': 0, 'seuil-maintien': 0, 'fin-prepa': 0, specifique: 0, affutage: 0 }
  if (n <= 0) return d
  if (n < 3) return { ...d, affutage: n }
  d.affutage = n >= 6 ? 2 : 1
  let reste = n - d.affutage
  d.specifique = Math.min(3, reste)
  reste -= d.specifique
  d['fin-prepa'] = Math.min(3, reste)
  reste -= d['fin-prepa']
  d.reprise = Math.min(reste, semainesReprise ?? (repriseLongue ? 4 : entraine ? 0 : 2))
  reste -= d.reprise
  // Cycle 1er seuil : la base de tout, dès qu'il reste plus de 4 semaines. Autant de 1er seuil que de 2e seuil (13/11/2026,
  // la semaine en plus au 1er seuil), 4 à 10 semaines chacun (Filipas 2022 : 8 + 8 ; durées = choix d'entraîneur)
  d.base = reste <= 4 ? 0 : Math.min(10, Math.max(4, Math.ceil(reste / 2)))
  const seuil = Math.min(10, reste - d.base)
  // 2e seuil : tirer (2 à 4 semaines) puis allonger le maintien
  d['seuil-tirage'] = seuil <= 2 ? seuil : seuil <= 4 ? 2 : Math.min(4, Math.ceil(seuil / 2))
  d['seuil-maintien'] = seuil - d['seuil-tirage']
  d.entretien = reste - d.base - seuil
  // Quelques semaines de trop : elles vont au cycle 1er seuil (jusqu'à 12) plutôt qu'à de l'entretien
  const vers1erSeuil = Math.min(d.entretien, 12 - d.base)
  d.base += vers1erSeuil
  d.entretien -= vers1erSeuil
  return d
}

export function calculerSaison(e: EntreeSaison) {
  const l0 = lundiDe(e.debut)
  const lc = lundiDe(e.course)
  const n = semainesEntre(l0, lc) + 1
  // Reprise selon la coupure (12/11/2026) : 0, 1, 2 ou 4 semaines ; 4 pour un débutant, 2 si tu ne roulais pas encore régulièrement
  const arret = e.arretSemaines ?? 0
  // Semaines déjà roulées depuis l'arrêt : retirées (pas de reprise faite deux fois, 13/11/2026)
  const brute = e.debutant ? 4 : e.entraine || arret >= 2 ? repriseSelonCoupure(arret) : 2
  const reprise = Math.max(0, brute - (e.repriseFaite ?? 0))
  const d = dureesPhases(n, arret >= 4 || !!e.debutant, !!e.entraine && !e.debutant && arret < 2, reprise)
  const phases: Phase[] = []
  let l = l0
  for (const type of ['reprise', 'entretien', 'base', 'seuil-tirage', 'seuil-maintien', 'fin-prepa', 'specifique', 'affutage'] as const) {
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

/** Écart minimum entre deux courses A (jours) et nombre maximum de courses A dans la saison : choix d'entraîneur. */
export const ECART_A_JOURS = 21
export const MAX_COURSES_A = 4

/**
 * Plusieurs courses A (relecture du 10/11/2026 : les pics multiples sont peu étudiés, Pyne 2009 ; on peut encore
 * progresser en 4 semaines avec un bloc VO2, Rønnestad 2014 ; durées = choix d'entraîneur). La saison est construite
 * vers la 1re A ; après chaque A : 1 semaine de récupération, puis selon l'écart jusqu'à la A suivante (en semaines) :
 *  - 3 à 6 : spécifique court, puis 1 semaine d'affûtage ;
 *  - 7 à 12 : bloc pour progresser encore (tirer le seuil, puis fin de prépa), 2 semaines de spécifique, 1 d'affûtage ;
 *  - plus de 12 : une mini-prépa (durées de saison, affûtage d'1 semaine).
 * Après la dernière A : récupération, puis entretien.
 */
export function phasesAvecCoursesA(phases: Phase[], datesA: string[]): Phase[] {
  const a = [...new Set(datesA)].sort()
  if (!a.length) return phases
  const premiere = lundiDe(a[0])
  // On garde la saison jusqu'à la 1re A comprise, puis on enchaîne
  const res = [...phases].sort((x, y) => x.debut.localeCompare(y.debut)).filter((p) => p.debut <= premiere)
  for (let i = 1; i < a.length; i++) {
    const lp = lundiDe(a[i - 1])
    const ln = lundiDe(a[i])
    const r = semainesEntre(lp, ln) - 1 // semaines après la récup, semaine de course comprise
    const blocs: [Phase['type'], number][] = [['recuperation', 1]]
    // Relecteur 10/11/2026 : affûtage de 2 semaines (×0,65 puis ×0,45) dès qu'il reste 4 semaines (Bosquet 2007, Wang 2023)
    if (r <= 5) blocs.push(['specifique', Math.max(0, r - (r >= 4 ? 2 : 1))], ['affutage', r >= 4 ? 2 : 1])
    else if (r <= 11) {
      const bloc = r - 3
      blocs.push(['seuil-tirage', Math.min(4, bloc - 1)], ['fin-prepa', bloc - 1 - Math.min(4, bloc - 1)], ['specifique', 2], ['affutage', 2])
    } else {
      const d = dureesPhases(r)
      for (const t of ['reprise', 'entretien', 'base', 'seuil-tirage', 'seuil-maintien', 'fin-prepa', 'specifique', 'affutage'] as const) blocs.push([t, d[t]])
    }
    let l = decaler(lp, 7)
    for (const [type, n] of blocs) {
      if (n > 0) res.push({ debut: l, type })
      l = decaler(l, 7 * n)
    }
  }
  const derniere = lundiDe(a[a.length - 1])
  res.push({ debut: decaler(derniere, 7), type: 'recuperation' }, { debut: decaler(derniere, 14), type: 'entretien' })
  return res
}

/** Dates des courses A retenues : 3 semaines d'écart au moins, 4 au plus (les autres comptent comme des B). */
export function datesCoursesA(courses: { date: string; niveau?: string }[]) {
  const res: string[] = []
  for (const c of [...courses].filter((x) => x.niveau === 'A').sort((x, y) => x.date.localeCompare(y.date))) {
    const prec = res[res.length - 1]
    if (res.length < MAX_COURSES_A && (!prec || (Date.parse(c.date) - Date.parse(prec)) / 86_400_000 >= ECART_A_JOURS)) res.push(c.date)
  }
  return res
}

/**
 * Tes 4 dernières semaines importées (relecture du 10/11/2026, choix d'entraîneur ; le ratio charge aiguë / chronique
 * est trop critiqué pour servir de règle, Impellizzeri 2020) : entraîné si au moins 3 semaines sur 4 ont 2 sorties ou
 * plus et au moins 60 % du budget de la semaine type. Budget de départ : la médiane des 4 semaines, −10 % si elles
 * sont irrégulières (une semaine sous la moitié de la médiane).
 */
export function lireHistorique(semaines: { sorties: number; kj: number }[], nominalKj: number) {
  if (semaines.length < 4) return { entraine: false as const }
  const bonnes = semaines.filter((s) => s.sorties >= 2 && s.kj >= nominalKj * 0.6).length
  const kj = semaines.map((s) => s.kj).sort((a, b) => a - b)
  const mediane = (kj[1] + kj[2]) / 2
  const irreguliere = semaines.some((s) => s.kj < mediane / 2)
  if (bonnes < 3) return { entraine: false as const }
  return { entraine: true as const, budgetDepart: Math.round((mediane * (irreguliere ? 0.9 : 1)) / 10) * 10 }
}

// ——— Charge habituelle et retour après une coupure (12/11/2026) ———

/** Une semaine complète passée (de la plus ancienne à la plus récente) : kJ de vélo, et si elle était prévue légère (affûtage, récupération). */
export interface SemaineVecue { kj: number; legere?: boolean }

/**
 * Part de ta charge habituelle d'où tu repars selon le nombre de semaines de coupure (relecteur du 12/11/2026) : un arrêt
 * fait perdre ~7 % de VO2max en 2 semaines et ~15 % en 2-3 mois (Coyle 1984 ; Mujika & Padilla 2000), lever le pied en
 * gardant de l'intensité préserve l'essentiel (Hickson 1985). Les pourcentages exacts sont des choix d'entraîneur.
 */
export const facteurCoupure = (n: number) => (n <= 1 ? 0.9 : n <= 3 ? 0.75 : n <= 6 ? 0.6 : 0.45)
/** Semaines de reprise (sans intensité) selon la coupure : 0, 1, 2 ou 4. */
export const repriseSelonCoupure = (n: number) => (n <= 1 ? 0 : n <= 3 ? 1 : n <= 6 ? 2 : 4)

/**
 * Charge habituelle : la moyenne de tes 4 meilleures semaines d'affilée sur les 26 dernières (6 mois) (un bloc tenu, pas un
 * record isolé ; sans affûtage ni récupération prévue). Coupure : les semaines d'après sous la moitié de cette charge
 * (hors légères prévues). Plancher : la part de ta charge habituelle d'où tu repars.
 */
export function chargeHabituelle(semaines: SemaineVecue[]) {
  let meilleur: { moyenne: number; fin: number } | undefined
  for (let i = 0; i + 4 <= semaines.length; i++) {
    const bloc = semaines.slice(i, i + 4)
    if (bloc.some((s) => s.legere)) continue
    const moyenne = bloc.reduce((a, s) => a + s.kj, 0) / 4
    if (!meilleur || moyenne > meilleur.moyenne) meilleur = { moyenne, fin: i + 3 }
  }
  if (!meilleur || meilleur.moyenne < 300) return undefined
  const habituelle = Math.round(meilleur.moyenne / 10) * 10
  const apres = semaines.slice(meilleur.fin + 1).filter((s) => !s.legere)
  const coupure = apres.filter((s) => s.kj < habituelle * 0.5).length
  const facteur = facteurCoupure(coupure)
  // Reprise (13/11/2026, choix d'entraîneur relu) : une semaine d'arrêt = presque pas de vélo (moins de 20 % de ta charge
  // habituelle) ; les semaines roulées depuis le dernier arrêt (40 % ou plus) comptent comme reprise déjà faite
  const arretee = (s: SemaineVecue) => s.kj < habituelle * 0.2
  const arret = apres.filter(arretee).length
  const dernier = apres.map(arretee).lastIndexOf(true)
  const repriseFaite = dernier < 0 ? 0 : apres.slice(dernier + 1).filter((s) => s.kj >= habituelle * 0.4).length
  return { habituelle, coupure, facteur, plancher: Math.round((habituelle * facteur) / 10) * 10, arret, repriseFaite }
}

/**
 * kJ d'une sortie sans capteur de puissance (historique seulement, 12/11/2026) : la part de FC de réserve donne à peu
 * près la part de CP tenue (≈ 65 % en endurance) ; sans FC, une endurance à 55 % de la CP. Choix d'entraîneur, à ±20 %.
 */
export function kjEstime(o: { dureeSec: number; fcMoy?: number; fcRepos: number; fcMax: number; cpW: number }) {
  const reserve = o.fcMoy && o.fcMax > o.fcRepos ? (o.fcMoy - o.fcRepos) / (o.fcMax - o.fcRepos) : undefined
  const part = reserve === undefined ? 0.55 : Math.min(0.95, Math.max(0.35, reserve))
  return Math.round((o.cpW * part * o.dureeSec) / 1000)
}

/**
 * Une même sortie peut arriver deux fois dans Intervals (Zwift en direct et par Garmin Connect, ou montre et compteur) :
 * deux sorties qui commencent à moins de 10 minutes d'écart ne comptent qu'une fois (on garde celle qui a le plus de kJ).
 */
export function sansDoublons<T extends { debut: string; kj: number }>(sorties: T[]): T[] {
  const triees = [...sorties].sort((a, b) => a.debut.localeCompare(b.debut))
  const res: T[] = []
  for (const s of triees) {
    const prec = res[res.length - 1]
    if (prec && Math.abs(Date.parse(s.debut) - Date.parse(prec.debut)) < 10 * 60_000) {
      if (s.kj > prec.kj) res[res.length - 1] = s
    } else res.push(s)
  }
  return res
}
