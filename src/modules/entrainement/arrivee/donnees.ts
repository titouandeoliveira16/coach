import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { enregistrer } from '../../../core/stockage'
import { zonesDepuisCp } from '../../../core/zones'
import { ageAu, type Profil } from '../../../core/profil'
import type { Discipline, Role } from '../../../metrics/programme'
import { calculerSaison } from '../../../metrics/saison'
import { niveauDuProfil } from '../../../metrics/programme'
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
  course: { nom: string; date: string }
}

export const SEMAINE_TYPE_DEPART: Role[] = ['libre', 'velo-dur', 'libre', 'velo-z2', 'libre', 'libre', 'velo-long']

/**
 * Semaine type de départ selon le temps disponible : 1 jour dur (mardi), 1 sortie longue (dimanche), le reste en Z2
 * (3 jours de vélo sous 4 h, jusqu'à 6 au-delà de 10 h ; choix d'entraîneur, modifiable en touchant les jours).
 * La 2e séance dure (confirmé ou expert, 6 h et plus) n'a pas besoin de jour à elle : le moteur la place sur une Z2.
 */
export function semaineDepuisHeures(heures?: string): Role[] {
  const n = ({ 'Moins de 4 h': 3, '4 à 6 h': 4, '6 à 8 h': 5, '8 à 10 h': 5, '10 à 12 h': 6, 'Plus de 12 h': 6 } as Record<string, number>)[heures ?? ''] ?? 4
  const t: Role[] = ['libre', 'velo-dur', 'libre', 'libre', 'libre', 'libre', 'velo-long']
  for (const i of [3, 5, 0, 4].slice(0, n - 2)) t[i] = 'velo-z2'
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
export function preparerArrivee(r: ReponsesArrivee, jour: string) {
  const age = ageAu(r.naissance, jour)
  const fcMax = r.fcMax ?? fcMaxTanaka(age)
  const cpW = r.cpW ?? cpProvisoire(r.poidsKg)
  const ps: ProfilSportif = {
    sports: [r.discipline === 'route' ? 'Vélo route' : 'VTT', ...(r.muscu && !/^Pas/.test(r.muscu) ? ['Musculation'] : [])],
    materiel: ['Capteur de puissance'],
    anciennete: r.anciennete, heuresRecentes: r.heuresRecentes, intervalles: r.intervalles,
    heuresSemaine: r.heuresSemaine, pointsSensibles: r.pointsSensibles || undefined, muscu: r.muscu, nutrition: r.nutrition,
  }
  const jourLong = r.semaineType.indexOf('velo-long')
  const jourDur = r.semaineType.indexOf('velo-dur')
  const saison = calculerSaison({
    debut: jour, course: r.course.date, arretSemaines: r.arretSemaines, debutant: niveauDuProfil(ps) === 'debutant',
    jourLong: jourLong >= 0 ? jourLong : 6, jourDur: jourDur >= 0 ? jourDur : 1, aujourdhui: jour,
  })
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
      competitions: [{ date: r.course.date, nom: r.course.nom.trim() || 'Course principale' }], discipline: r.discipline,
    },
  }
  return { profil, entrainement, profilSportif: ps, saison, cpConnue: r.cpW !== undefined, fcConnue: r.fcMax !== undefined }
}

/** Réglage « arrivee » : le questionnaire est fait (sinon il s'affiche à l'ouverture d'un compte créé avec un code). */
export interface EtatArrivee { fait?: string; montre?: 'reliee' | 'plus-tard' }

export async function enregistrerArrivee(r: ReponsesArrivee) {
  const jour = aujourdhui()
  const p = preparerArrivee(r, jour)
  await enregistrer(db.reglages, { id: 'profil', valeur: p.profil })
  await enregistrer(db.reglages, { id: 'entrainement', valeur: p.entrainement })
  await enregistrer(db.reglages, { id: 'profil-sportif', valeur: p.profilSportif })
  await enregistrer(db.reglages, { id: 'arrivee', valeur: { fait: jour } satisfies EtatArrivee })
  // La semaine en cours (et la suivante si on est déjà en fin de semaine) est construite tout de suite
  const { genererSemaineVelo } = await import('../plan/programme')
  const { lundiDe } = await import('../seances/donnees')
  await genererSemaineVelo(lundiDe(jour)).catch(() => {})
  if (new Date(`${jour}T12:00:00`).getDay() === 0) await genererSemaineVelo(decalerJour(lundiDe(jour), 7)).catch(() => {})
  return p
}
