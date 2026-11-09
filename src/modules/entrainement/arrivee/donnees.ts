import { db } from '../../../core/db'
import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { zonesDepuisCp } from '../../../core/zones'
import { ageAu, type Profil } from '../../../core/profil'
import type { Competition, Discipline, Role } from '../../../metrics/programme'
import { calculerSaison } from '../../../metrics/saison'
import { dureeDeCourse, epreuveDe, niveauDuProfil } from '../../../metrics/programme'
import type { ProfilSportif } from '../reglages/ProfilSportif'
import { DEFAUT_ENTRAINEMENT } from '../reglagesEntrainement'
import type { ReglagesEntrainement, ZoneVelo } from '../types'

/** Réponses du questionnaire d'arrivée d'un nouveau compte (élève, frère…). */
export interface ReponsesArrivee {
  naissance: string
  sexe: 'homme' | 'femme'
  tailleCm?: number
  poidsKg?: number
  /** CP, ou FTP Zwift prise telle quelle (× 1,0 : la règle « 75 % de la meilleure minute » n'est pas validée) */
  cpW?: number
  fcMax?: number
  discipline: Discipline
  anciennete?: string
  heuresRecentes?: string
  intervalles?: boolean
  arretSemaines: number
  heuresSemaine?: string
  pointsSensibles?: string
  muscu?: string
  /** Suivi de la nutrition (besoins du jour, repas du soir), en option comme la muscu */
  nutrition: boolean
  semaineType: Role[]
  maxSemaineMin: number
  minLongMin: number
  maxLongMin: number
  /** Course principale : distance, dénivelé et durée donnée comme les autres courses */
  course: { nom: string; date: string; distanceKm?: number; deniveleM?: number; dureeMin?: number }
  /** Autres courses (facultatif) : B importante, C pour s'entraîner */
  autresCourses?: Competition[]
  /** Route : course en ligne (FFC…) ou cyclosportive / longue distance */
  typeCourse?: 'en-ligne' | 'cyclo'
  /** Durée prévue de la course (min) : route et marathon VTT */
  dureeCourseMin?: number
}

export const SEMAINE_TYPE_DEPART: Role[] = ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'velo-long', 'libre']

/**
 * Semaine type selon le nombre de jours de vélo (semaines types de Mathias Chauvin) : 1 jour dur (mardi), la sortie
 * longue le week-end, le reste en Z2. À partir de 4 jours, le moteur place lui-même la 2e séance intensive sur une Z2
 * (la plus éloignée du mardi : vendredi ou samedi). Modifiable en touchant les jours.
 */
export function semaineDepuisJours(n: number): Role[] {
  const t: Role[] = ['libre', 'velo-dur', 'libre', 'libre', 'libre', 'libre', 'libre']
  if (n <= 3) { t[3] = 'velo-z2'; t[6] = 'velo-long'; return t }
  if (n === 4) { t[3] = 'velo-z2'; t[5] = 'velo-z2'; t[6] = 'velo-long'; return t }
  t[2] = 'velo-z2'; t[3] = 'velo-z2'; t[5] = 'velo-z2'; t[6] = 'velo-long'
  if (n >= 6) t[0] = 'velo-z2'
  return t
}

/** FC max provisoire (Tanaka 2001 : 208 − 0,7 × âge, ±10 bpm) en attendant la plus haute vue dans tes sorties. */
export const fcMaxTanaka = (age: number) => Math.round(208 - 0.7 * age)
/** CP provisoire sans test ni FTP : 2,5 W/kg, volontairement prudent (choix d'entraîneur) ; le test de la 1re semaine la remplace. */
export const cpProvisoire = (kg?: number) => Math.round(((kg ?? 70) * 2.5) / 5) * 5

/** Bornes de FC provisoires en % de la FC max (choix d'entraîneur), recalées ensuite sur tes sorties (« Caler les bpm »). */
function zonesFc(fcMax: number): { fcMin?: number; fcMax?: number }[] {
  const b = [0, 0.7, 0.8, 0.87, 0.93, 1].map((x) => Math.round(fcMax * x))
  return [0, 1, 2, 3, 4].map((i) => ({ fcMin: b[i], fcMax: b[i + 1] }))
}

/** Tout ce que le questionnaire enregistre (pur : testé). */
export function preparerArrivee(r: ReponsesArrivee, jour: string, testsFaits: ReglagesEntrainement['tests'] = []) {
  const age = ageAu(r.naissance, jour)
  const fcMax = r.fcMax ?? fcMaxTanaka(age)
  const cpW = r.cpW ?? cpProvisoire(r.poidsKg)
  const ps: ProfilSportif = {
    sports: [r.discipline === 'route' ? 'Vélo route' : 'VTT', ...(r.muscu && !/^Pas/.test(r.muscu) ? ['Musculation'] : [])],
    materiel: ['Capteur de puissance'],
    anciennete: r.anciennete, heuresRecentes: r.heuresRecentes, intervalles: r.intervalles,
    heuresSemaine: r.heuresSemaine, pointsSensibles: r.pointsSensibles || undefined, muscu: r.muscu, nutrition: r.nutrition,
  }
  const principale: Competition = {
    date: r.course.date, nom: r.course.nom.trim() || 'Course principale', niveau: 'A', epreuve: epreuveDe(r.discipline, r.typeCourse),
    ...(r.course.distanceKm ? { distanceKm: r.course.distanceKm } : {}), ...(r.course.deniveleM ? { deniveleM: r.course.deniveleM } : {}), ...(r.course.dureeMin ? { dureeMin: r.course.dureeMin } : {}),
  }
  const dureePrincipale = r.course.distanceKm || r.course.dureeMin
    ? dureeDeCourse(principale, { discipline: r.discipline, typeCourse: r.typeCourse, cpW: r.cpW, poidsKg: r.poidsKg })
    : r.dureeCourseMin
  const jourLong = r.semaineType.indexOf('velo-long')
  const jourDur = r.semaineType.indexOf('velo-dur')
  const saison = calculerSaison({
    debut: jour, course: r.course.date, arretSemaines: r.arretSemaines, debutant: niveauDuProfil(ps) === 'debutant',
    jourLong: jourLong >= 0 ? jourLong : 6, jourDur: jourDur >= 0 ? jourDur : 1, aujourdhui: jour,
  })
  // CP déjà testée ces 4 dernières semaines (compte déjà utilisé) : pas de nouveau test dans les 2 premières semaines
  if (testsFaits.some((t) => t.type === 'cp' && t.date <= jour && ecartJours(t.date, jour) <= 28)) {
    const garder = (d: string) => d >= decalerJour(jour, 14)
    saison.testsCp = saison.testsCp.filter(garder)
    saison.testsCourts = saison.testsCourts.filter(garder)
  }
  const profil: Profil = { naissance: r.naissance, sexe: r.sexe, tailleCm: r.tailleCm, poidsKg: r.poidsKg, fcMax, objectif: 'maintien' }
  const entrainement: ReglagesEntrainement = {
    ...DEFAUT_ENTRAINEMENT,
    vmaKmh: undefined,
    cpW,
    zonesVelo: zonesDepuisCp(cpW, zonesFc(fcMax)) as ZoneVelo[],
    tests: [],
    programme: {
      semaineType: r.semaineType, maxSemaineMin: r.maxSemaineMin, minLongMin: r.minLongMin, maxLongMin: r.maxLongMin,
      phases: saison.phases, testsCp: saison.testsCp, testsCourts: saison.testsCourts,
      competitions: [principale, ...(r.autresCourses ?? []).filter((x) => x.date !== r.course.date)], discipline: r.discipline, modele: 'chauvin', ...(r.discipline === 'route' ? { typeCourse: r.typeCourse ?? 'cyclo' } : {}),
      // Durée de la course principale : donnée, ou estimée par sa distance et son dénivelé (règle la sortie longue visée)
      ...(dureePrincipale ? { dureeCourseMin: dureePrincipale } : {}),
    },
  }
  return { profil, entrainement, profilSportif: ps, saison, cpConnue: r.cpW !== undefined, fcConnue: r.fcMax !== undefined }
}

/**
 * Réponses déjà connues d'un compte qui a déjà servi (Titouan, passé au questionnaire en 11/2026) : profil, CP, FC max,
 * profil sportif et programme. Undefined pour un compte neuf. Les jours de course de l'ancienne semaine type deviennent libres.
 */
export async function reponsesExistantes() {
  const [p, e, ps] = await Promise.all(['profil', 'entrainement', 'profil-sportif'].map((id) => db.reglages.get(id)))
  const profil = p?.valeur as Profil | undefined
  const ent = e?.valeur as ReglagesEntrainement | undefined
  const sportif = ps?.valeur as ProfilSportif | undefined
  if (!profil && !ent && !sportif) return undefined
  const prog = ent?.programme
  const reponses: Partial<ReponsesArrivee> = {
    ...(profil?.naissance ? { naissance: profil.naissance } : {}),
    ...(profil?.sexe ? { sexe: profil.sexe } : {}),
    ...(prog?.discipline ? { discipline: prog.discipline } : {}),
    ...(sportif ? {
      anciennete: sportif.anciennete, heuresRecentes: sportif.heuresRecentes, intervalles: sportif.intervalles, heuresSemaine: sportif.heuresSemaine,
      pointsSensibles: sportif.pointsSensibles, muscu: sportif.muscu, nutrition: sportif.nutrition !== false,
    } : {}),
    ...(prog ? {
      semaineType: prog.semaineType.map((x) => (x === 'course' ? 'libre' : x)),
      maxSemaineMin: prog.maxSemaineMin, minLongMin: prog.minLongMin, maxLongMin: prog.maxLongMin,
      ...(prog.typeCourse ? { typeCourse: prog.typeCourse } : {}),
      ...(prog.dureeCourseMin ? { dureeCourseMin: prog.dureeCourseMin } : {}),
      // Course principale encore à venir : préremplie (distance, dénivelé, durée)
      ...((() => {
        const a = prog.competitions.find((x) => x.niveau === 'A' && x.date > aujourdhui())
        return a ? { course: { nom: a.nom, date: a.date, ...(a.distanceKm ? { distanceKm: a.distanceKm } : {}), ...(a.deniveleM ? { deniveleM: a.deniveleM } : {}), ...(a.dureeMin ? { dureeMin: a.dureeMin } : {}) } } : {}
      })()),
      // Courses B et C déjà notées : gardées
      ...(prog.competitions.some((x) => x.niveau === 'B' || x.niveau === 'C') ? { autresCourses: prog.competitions.filter((x) => x.niveau === 'B' || x.niveau === 'C') } : {}),
    } : {}),
  }
  const texte = (v?: number) => (v ? String(v) : '')
  return {
    reponses: Object.fromEntries(Object.entries(reponses).filter(([, v]) => v !== undefined)) as Partial<ReponsesArrivee>,
    textes: { taille: texte(profil?.tailleCm), poids: texte(profil?.poidsKg), cp: texte(ent?.cpW), fc: texte(profil?.fcMax) },
  }
}

/** Réglage « arrivee » : le questionnaire est fait (sinon il s'affiche à l'ouverture d'un compte créé avec un code). */
export interface EtatArrivee { fait?: string; montre?: 'reliee' | 'plus-tard' }

export async function enregistrerArrivee(r: ReponsesArrivee) {
  const jour = aujourdhui()
  const lire = async <T,>(id: string) => (await db.reglages.get(id))?.valeur as T | undefined
  const [profilAvant, entAvant, psAvant] = [await lire<Profil>('profil'), await lire<ReglagesEntrainement>('entrainement'), await lire<ProfilSportif>('profil-sportif')]
  const p = preparerArrivee(r, jour, entAvant?.tests)
  // Compte déjà utilisé : les données acquises restent (tests CP, bornes de FC calées, W', réglages divers, objectif
  // nutrition…) ; seuls le programme (saison calculée) et les réponses du questionnaire changent
  await enregistrer(db.reglages, { id: 'profil', valeur: { ...profilAvant, ...p.profil, objectif: profilAvant?.objectif ?? p.profil.objectif } })
  await enregistrer(db.reglages, {
    id: 'entrainement',
    valeur: entAvant
      ? { ...entAvant, cpW: p.entrainement.cpW, zonesVelo: entAvant.zonesVelo?.length ? zonesDepuisCp(p.entrainement.cpW!, entAvant.zonesVelo) as ZoneVelo[] : p.entrainement.zonesVelo, programme: p.entrainement.programme }
      : p.entrainement,
  })
  await enregistrer(db.reglages, { id: 'profil-sportif', valeur: { ...psAvant, ...p.profilSportif, materiel: psAvant?.materiel?.length ? psAvant.materiel : p.profilSportif.materiel } })
  await enregistrer(db.reglages, { id: 'arrivee', valeur: { fait: jour } satisfies EtatArrivee })
  // La semaine en cours (et la suivante si on est déjà en fin de semaine) est construite tout de suite
  const { genererSemaineVelo } = await import('../plan/programme')
  const { lundiDe } = await import('../seances/donnees')
  await genererSemaineVelo(lundiDe(jour)).catch(() => {})
  if (new Date(`${jour}T12:00:00`).getDay() === 0) await genererSemaineVelo(decalerJour(lundiDe(jour), 7)).catch(() => {})
  return p
}
