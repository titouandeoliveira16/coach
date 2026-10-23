/** Zone d'intensité vélo : plage de puissance et plage de FC correspondante. */
export interface ZoneVelo {
  nom: string
  wMin: number
  /** Absent pour la zone la plus haute (ex. sprint > 674 W) */
  wMax?: number
  fcMin?: number
  fcMax?: number
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
