import type { Note } from '../../core/ui/ChoixNote'

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
  sommeil?: Note
  /** Énergie / fraîcheur (l'inverse de la fatigue) */
  energie?: Note
  /** Jambes : 5 = aucune courbature */
  jambes?: Note
  motivation?: Note
  /** 5 = serein, 1 = très stressé */
  serenite?: Note
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
  bloc?: BlocCourse
}

export type Sport = 'velo' | 'course'
export type Intensite = 'basse' | 'moyenne' | 'haute'

/** Types de séance (mêmes intitulés que Campus Coach et la prépa vélo). */
export const TYPES_SEANCE = ['Endurance', 'Sortie longue', 'Seuil', 'Fractionné / VMA', 'Récupération', 'Compétition', 'Test'] as const
export type TypeSeance = (typeof TYPES_SEANCE)[number]

/** Raisons d'indisponibilité ou de séance non faite. */
export const RAISONS = ['Boulot', 'Cours / fac', 'Stage', 'Fatigue', 'Malade', 'Douleur / blessure', 'Météo', 'Perso'] as const
export type Raison = (typeof RAISONS)[number]

/** Une séance réalisée (saisie, importée d'un .FIT ou de Strava). */
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
  source: 'manuel' | 'fit' | 'strava'
  stravaId?: number
  /** Séance prévue à laquelle elle correspond */
  prevueId?: string
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
  priorite: 'cle' | 'normale'
  longue?: boolean
  statut: 'prevue' | 'faite' | 'non-faite' | 'reportee' | 'abandonnee'
  raison?: Raison
  origine: 'manuel' | 'propose'
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
}

/** Bloc de course à pied (objectif). */
export interface BlocCourse {
  objectif: '5k' | '10k' | 'semi' | 'marathon' | 'entretien'
  dateObjectif?: string
  /** Lundi de début du bloc */
  debut: string
  seancesParSemaine: number
}
