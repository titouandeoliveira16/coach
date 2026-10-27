import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { AGE_DEFAUT, ageAu, PROFIL_DEFAUT, type Profil } from '../../../core/profil'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { besoinsDuJour, kcalActivite, partGlucides, reductionsEtalement, tendancePoids, type ActiviteJour } from '../../../metrics/nutrition'
import { chargerContexte, domaineDe } from '../seances/donnees'
import { peseesValides, poidsAu } from './pesees'
import type { Intensite } from '../types'

/** Réglage « nutrition » : ajustements validés par Titouan. */
export interface ReglagesNutrition {
  /** Écart maintien mesuré − formule (kcal/j), et jour où il a été validé */
  correction?: number
  correctionLe?: string
  /** Ne pas reproposer la calibration avant ce jour */
  calibrationPlusTard?: string
  /** Excès à étaler (jour, kcal) */
  etalements?: { date: string; kcal: number }[]
  /** Jours où l'étalement a été refusé (pour ne pas redemander) */
  etalementsRefuses?: string[]
}
export const lireReglagesNutrition = async () => ((await db.reglages.get('nutrition'))?.valeur as ReglagesNutrition | undefined) ?? {}
export const modifierReglagesNutrition = async (c: Partial<ReglagesNutrition>) =>
  enregistrer(db.reglages, { id: 'nutrition', valeur: { ...(await lireReglagesNutrition()), ...c } })

const ORDRE: Intensite[] = ['basse', 'moyenne', 'haute']
const plusDure = (a: Intensite, b?: Intensite) => (b && ORDRE.indexOf(b) > ORDRE.indexOf(a) ? b : a)

/**
 * Besoins du jour : séances faites (mesures réelles) + séances encore prévues ce jour-là.
 * Si la séance change, ce sont les séances réellement faites qui comptent.
 * Options : sans la correction du maintien mesuré, sans l'étalement d'un excès (calculs internes).
 */
export async function besoinsDe(jour: string, o: { sansCorrection?: boolean; sansEtalement?: boolean } = {}) {
  const n = await lireReglagesNutrition()
  const profil = { ...PROFIL_DEFAUT, ...((await db.reglages.get('profil'))?.valeur as Profil | undefined) }
  const kg = (await poidsAu(jour)) ?? profil.poidsKg ?? 76
  const c = await chargerContexte()
  const seances = await db.seances.where('date').equals(jour).toArray()
  const prevues = await db.prevues.where('date').equals(jour).toArray()

  const faites: ActiviteJour[] = seances.map((s) => ({
    sport: s.sport,
    dureeMin: s.dureeSec / 60,
    // La plus dure entre ce que disent la FC / le RPE et la séance prévue qu'elle remplit
    intensite: plusDure(domaineDe(s, c.bornes), prevues.find((p) => p.id === s.prevueId)?.intensite),
    // Vélo dehors sans capteur : les kJ prévus de la séance qu'elle remplit
    kj: s.kj ?? prevues.find((p) => p.id === s.prevueId)?.kjPrevu,
    distanceKm: s.distanceKm,
    // Part de glucides d'après le temps passé dans chaque zone (continu : 1 min ou 7 min en Z5 ne coûtent pas pareil)
    partGlucides: s.tempsZones ? partGlucides(s.tempsZones) : undefined,
  }))
  const aFaire: ActiviteJour[] = prevues
    .filter((p) => p.statut === 'prevue' && !seances.some((s) => s.prevueId === p.id))
    .map((p) => ({ sport: p.sport, dureeMin: p.dureeMin, intensite: p.intensite, kj: p.kjPrevu }))

  // Détail lisible : chaque séance (faite ou encore prévue) et ce qu'elle coûte
  const nomSport = (sport: string) => (sport === 'velo' ? 'Vélo' : sport === 'course' ? 'Course' : sport === 'natation' ? 'Natation' : 'Séance')
  const pasFaites = prevues.filter((p) => p.statut === 'prevue' && !seances.some((s) => s.prevueId === p.id))
  const detailSeances = [
    ...seances.map((s, i) => ({ titre: s.titre ?? nomSport(s.sport), kcal: Math.round(kcalActivite(faites[i], kg)), faite: true })),
    ...pasFaites.map((p, i) => ({ titre: p.titre, kcal: Math.round(kcalActivite(aFaire[i], kg)), faite: false })),
  ]
  const pas = await pasDuJour(jour)
  const b = besoinsDuJour({
    kg, cm: profil.tailleCm ?? PROFIL_DEFAUT.tailleCm!, age: profil.naissance ? ageAu(profil.naissance, jour) : AGE_DEFAUT, activites: [...faites, ...aFaire], objectif: profil.objectif, pas: pas?.valeur,
    correction: o.sansCorrection ? 0 : n.correction,
    reduction: o.sansEtalement ? 0 : await reductionDuJour(jour, n),
  })
  const tendance = tendancePoids(await peseesValides(), jour)
  const demain = (await db.prevues.where('date').equals(decalerJour(jour, 1)).toArray())
    .find((p) => p.statut === 'prevue' && (p.intensite === 'haute' || p.dureeMin >= 90))
  return { ...b, detailSeances, pas, correction: o.sansCorrection ? undefined : n.correction, etalementDu: b.reduction ? n.etalements?.filter((e) => e.date < jour).at(-1)?.date : undefined, kg, objectif: profil.objectif ?? 'maintien', tendance, nbFaites: faites.length, nbAFaire: aFaire.length, demain: demain?.titre }
}

/** Pas courus, déjà comptés dans les calories de la course : ceux de la montre (cadence × temps de la séance) ;
 * à défaut, la distance / une foulée de ~1,2 m, sinon la durée × 165 pas/min. */
const PAS_PAR_MIN_COURSE = 165
const FOULEE_COURSE_M = 1.2

/**
 * Pas d'un jour, hors course : total de la montre − pas des courses.
 * undefined si la montre ne les a pas donnés, ou si son total est plus petit que les pas de la course :
 * le total du jour n'est alors pas encore à jour (il arrive souvent après la séance).
 */
async function pasHorsCourse(jour: string) {
  const pas = (await db.mesures.get(jour))?.pas
  if (pas === undefined) return undefined
  const course = (await db.seances.where('date').equals(jour).toArray()).filter((s) => s.sport === 'course')
    .reduce((a, s) => a + (s.pas ?? (s.distanceKm ? (s.distanceKm * 1000) / FOULEE_COURSE_M : PAS_PAR_MIN_COURSE * (s.dureeSec / 60))), 0)
  return pas < course ? undefined : Math.round(pas - course)
}

/** Part de la journée encore à venir pour marcher (journée éveillée de 7 h à 22 h), de 1 à 0. */
export function partRestante(maintenant: Date) {
  const h = maintenant.getHours() + maintenant.getMinutes() / 60
  return Math.min(1, Math.max(0, (22 - h) / 15))
}

/**
 * Pas pris en compte pour un jour : ceux de la montre (hors course).
 * Aujourd'hui (journée en cours) : les pas déjà faits + ce qu'il reste probablement à faire d'ici 22 h
 * (ta moyenne des 7 jours × la part de la journée qui reste). Le soir, c'est presque uniquement tes vrais pas.
 */
export async function pasDuJour(jour: string, maintenant = new Date()): Promise<{ valeur: number; moyenne: boolean; dejaFaits?: number; aVenir?: number; montre?: number; enRetard?: boolean } | undefined> {
  const duJour = await pasHorsCourse(jour)
  // Ce qu'affiche la montre (course comprise), pour comparer
  const montre = (await db.mesures.get(jour))?.pas
  if (jour < aujourdhui()) return duJour === undefined ? undefined : { valeur: duJour, moyenne: false }
  const valeurs: number[] = []
  for (let i = 1; i <= 7; i++) {
    const v = await pasHorsCourse(decalerJour(jour, -i))
    if (v !== undefined) valeurs.push(v)
  }
  const moyenne = valeurs.length >= 3 ? Math.round(valeurs.reduce((a, b) => a + b, 0) / valeurs.length) : undefined
  if (moyenne === undefined && duJour === undefined) return undefined
  if (moyenne === undefined) return { valeur: duJour!, moyenne: false, dejaFaits: duJour, montre }
  // Total de la montre pas encore à jour (plus petit que la course) ou rien reçu : ta moyenne
  if (duJour === undefined) return { valeur: moyenne, moyenne: true, montre, enRetard: montre !== undefined }
  const aVenir = Math.round(moyenne * partRestante(maintenant))
  return { valeur: duJour + aVenir, moyenne: false, dejaFaits: duJour, aVenir, montre }
}

/** kcal retirées ce jour-là pour étaler les excès des 7 jours précédents (jours faciles seulement). */
async function reductionDuJour(jour: string, n: ReglagesNutrition) {
  const recents = (n.etalements ?? []).filter((e) => e.date < jour && e.date >= decalerJour(jour, -7))
  if (!recents.length) return 0
  const debut = recents.map((e) => e.date).sort()[0]
  const jours: { date: string; facile: boolean }[] = []
  for (let d = decalerJour(debut, 1); d <= jour; d = decalerJour(d, 1))
    jours.push({ date: d, facile: (await besoinsDe(d, { sansEtalement: true })).journee === 'facile' })
  return reductionsEtalement(recents, jours).get(jour) ?? 0
}
