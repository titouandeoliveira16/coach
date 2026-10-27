import type { Note } from '../../core/ui/ChoixNote'
import type { Phase, Role, SeanceVelo } from '../../metrics/programme'

export type { Note }

/** Zone d'intensité vélo : plage de puissance et plage de FC correspondante. */
export interface ZoneVelo {
  nom: string
  wMin: number
  /** Absent pour la zone la plus haute (ex. sprint > 674 W) */
  wMax?: number
  fcMin?: number
  fcMax?: number
}

/**
 * Mesure du matin (« garde-fous » de la charge interne).
 * Tout est facultatif : on saisit ce qu'on a.
 */
export interface MesureMatin {
  /** Jour, "2026-10-23" (une mesure par jour) */
  date: string
  /** VFC en ms : le rMSSD du Statut VFC Garmin (moyenne de la nuit) */
  vfcMs?: number
  /** FC de repos (bpm) */
  fcRepos?: number
  /** Durée de sommeil (h) */
  sommeilH?: number
  /** Pas de la journée (montre, via Intervals.icu) */
  pas?: number
  sommeil?: Note
  /** Énergie / fraîcheur (l'inverse de la fatigue) */
  energie?: Note
  /** Jambes : 5 = aucune courbature */
  jambes?: Note
  motivation?: Note
  /** 5 = serein, 1 = très stressé */
  serenite?: Note
  /** Nuit sans montre (ou portée en partie) : VFC, FC de repos et sommeil de cette nuit sont ignorés */
  sansMontre?: boolean
  modifieLe: string
}

/** Réglages propres au module Entraînement. */
export interface ReglagesEntrainement {
  /** Vitesse maximale aérobie (km/h) */
  vmaKmh?: number
  /** Puissance critique (W) */
  cpW?: number
  /** Capacité de travail au-dessus de la CP (kJ) */
  wPrimeKj?: number
  zonesVelo: ZoneVelo[]
  /** Allure seuil en % de VMA (rTSS) */
  seuilCoursePct: number
  /** Charge de référence du tableau de bord */
  chargeRef: 'trimp' | 'srpe'
  /** Distribution d'intensité visée */
  modeleCible: 'polarise' | 'pyramidal'
  tests: TestPhysio[]
  /** Objectif de kJ sur une période (système kJ : 90 jours) */
  objectifKj?: ObjectifKj
  programme: ReglagesProgramme
}

/** Programme vélo automatique : semaine type, phases, tests et compétitions. */
export interface ReglagesProgramme {
  /** Rôle de chaque jour, du lundi au dimanche */
  semaineType: Role[]
  /** Durée maximale d'une séance vélo en semaine et le jour de la sortie longue (min) */
  maxSemaineMin: number
  maxLongMin: number
  minLongMin: number
  phases: Phase[]
  /** Dates des tests CP prévus */
  testsCp: string[]
  /** Parmi eux, les tests courts (3' + 12') ; les autres sont complets (12-7-3) */
  testsCourts?: string[]
  /** Compétitions (course à pied ou vélo) : semaine allégée, pas d'intensité vélo juste avant */
  competitions: { date: string; nom: string }[]
  /** Puissance Z2 de départ (W) : ajustée ensuite automatiquement */
  z2W?: number
}

/** Objectif de travail cumulé (kJ) entre deux dates. */
export interface ObjectifKj {
  debut: string
  fin: string
  kj: number
}

export type Sport = 'velo' | 'course' | 'natation' | 'renfo' | 'autre'
export type Intensite = 'basse' | 'moyenne' | 'haute'

/** Types de séance (mêmes intitulés que Campus Coach et la prépa vélo). */
export const TYPES_SEANCE = ['Endurance', 'Sortie longue', 'Seuil', 'Fractionné / VMA', 'Récupération', 'Compétition', 'Test'] as const
export type TypeSeance = (typeof TYPES_SEANCE)[number]

/**
 * Séances de course Campus Coach (intensités en temps de maintien).
 * `fi` = facteur d'intensité (vitesse / vitesse au seuil 60) : sert à estimer la charge prévue.
 */
export const TYPES_COURSE = {
  'Endurance fondamentale': { intensite: 'basse', fi: 0.75, type: 'Endurance' },
  'Sortie longue': { intensite: 'basse', fi: 0.75, type: 'Sortie longue' },
  'Endurance active': { intensite: 'basse', fi: 0.82, type: 'Endurance' },
  Tempo: { intensite: 'moyenne', fi: 0.87, type: 'Seuil' },
  'Allure spécifique': { intensite: 'moyenne', fi: 0.92, type: 'Seuil' },
  'Sweet spot': { intensite: 'moyenne', fi: 0.95, type: 'Seuil' },
  'Seuil 60': { intensite: 'haute', fi: 1, type: 'Seuil' },
  'Seuil 30': { intensite: 'haute', fi: 1.04, type: 'Seuil' },
  VMA: { intensite: 'haute', fi: 1.15, type: 'Fractionné / VMA' },
  Côtes: { intensite: 'haute', fi: 1.1, type: 'Fractionné / VMA' },
  Test: { intensite: 'haute', fi: 1.15, type: 'Test' },
  Compétition: { intensite: 'haute', fi: 1.05, type: 'Compétition' },
} as const satisfies Record<string, { intensite: Intensite; fi: number; type: TypeSeance }>
export type TypeCourse = keyof typeof TYPES_COURSE

/** Raisons d'indisponibilité ou de séance non faite. */
export const RAISONS = ['Boulot', 'Cours / fac', 'Stage', 'Fatigue', 'Malade', 'Douleur / blessure', 'Matériel', 'Météo', 'Perso', 'Semaine chargée'] as const
export type Raison = (typeof RAISONS)[number]

/** Une séance réalisée (saisie, importée d'un .FIT ou d'Intervals.icu). */
export interface Seance {
  id: string
  /** Jour, "2026-10-23" */
  date: string
  /** Heure de départ (ISO) : sert à reconnaître un doublon (± 2 min) */
  debut?: string
  sport: Sport
  type?: TypeSeance
  titre?: string
  /** Durée en mouvement (s) */
  dureeSec: number
  distanceKm?: number
  deniveleM?: number
  fcMoy?: number
  fcMax?: number
  /** RPE CR-10 (0 à 10, pas de 0,5) */
  rpe?: number
  sensations?: Note
  notes?: string
  // Vélo
  homeTrainer?: boolean
  puissanceMoyW?: number
  puissanceNormW?: number
  kj?: number
  // Calculés à l'enregistrement (voir metrics/)
  /** Secondes dans chaque zone FC (Z1 à Z5) */
  tempsZones?: number[]
  trimp?: number
  /** Vrai si le TRIMP vient du flux de FC complet (sinon : estimé depuis la FC moyenne) */
  trimpFlux?: boolean
  /** TSS (vélo avec puissance) ou rTSS (course) */
  tss?: number
  /** Découplage cardiaque (%) pour les séances ≥ 45 min avec flux */
  decouplage?: number
  /** Meilleures puissances moyennes (W) sur 3, 7 et 12 min (clé : durée en s) */
  meilleurs?: Record<string, number>
  source: 'manuel' | 'fit' | 'intervals'
  /** Identifiant de l'activité chez Intervals.icu */
  idExterne?: string
  /** Identifiants des doublons fusionnés dans cette séance (ex. même sortie vue par la montre et le compteur) */
  autresIds?: string[]
  /** Séance prévue à laquelle elle correspond */
  prevueId?: string
  /** Nombre d'activités enchaînées regroupées dans cette séance (ex. échauffement, test, retour au calme) */
  parties?: number
  /** Watts moyens de chaque bloc de travail, comparés à la cible de la séance prévue (et montée de FC dans chaque bloc, %) */
  blocs?: { cibleW: number; dureeSec: number; w: number[]; deriveFc?: number[]; fcFin?: number[] }
  /** Intervalles VO2 : secondes à 90 % ou plus de la FC max */
  tempsFc90?: number
  /** « En réserve ? » après le RPE : ok (facile tenable 1-2 h / 0-1 répétition en réserve), moyen, non */
  reserve?: 'ok' | 'moyen' | 'non'
  /** Pas de ceinture cardio (FC au poignet) : la FC de la séance n'est pas jugée */
  sansCeinture?: boolean
}

/** Une séance prévue dans le plan de la semaine. */
export interface SeancePrevue {
  id: string
  date: string
  sport: Sport
  titre: string
  type?: TypeSeance
  intensite: Intensite
  dureeMin: number
  /** Consignes (allures, blocs…) */
  detail?: string
  /** Travail prévu (kJ) : budget de la séance, système kJ */
  kjPrevu?: number
  priorite: 'cle' | 'normale'
  longue?: boolean
  statut: 'prevue' | 'faite' | 'non-faite' | 'reportee' | 'abandonnee'
  raison?: Raison
  /** auto = générée par le programme vélo */
  origine: 'manuel' | 'propose' | 'auto'
  /** Course : type Campus Coach et minutes à l'allure clé */
  typeCourse?: TypeCourse
  minutesCle?: number
  /** Vélo généré : famille, format, palier, cible */
  velo?: SeanceVelo
  /** Intensité reportée à cause d'un feu rouge : date d'origine */
  reporteeDu?: string
  /** Changée de jour à la main : le recalcul du vélo la laisse où elle est */
  deplacee?: boolean
  /** Minutes ajoutées pour compenser un imprévu (ex. vélo en panne) */
  compensationMin?: number
  /** Séance d'intensité : blocs tous tenus ou non (fait avancer la progression) */
  resultat?: 'reussie' | 'ratee'
}

/** Un jour d'indisponibilité. */
export interface Indispo {
  date: string
  raison: Raison
  creneau?: string
}

/** Décision du jour : signal calculé et éventuel forçage. */
export interface Decision {
  date: string
  couleur: 'vert' | 'orange' | 'rouge'
  force: boolean
}

/** Historique des tests (VMA, CP). */
export interface TestPhysio {
  date: string
  type: 'vma' | 'cp'
  valeur: number
  /** Poids le jour du test (rapport poids / puissance) */
  poidsKg?: number
}
