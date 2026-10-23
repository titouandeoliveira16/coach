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
}
