import { useReglage } from './reglages'

/** Profil commun à tous les modules (l'entraînement comme la nutrition s'en servent). */
export interface Profil {
  /** Mis à jour automatiquement à chaque pesée */
  poidsKg?: number
  tailleCm?: number
  fcMax?: number
  /** Jour de la pesée hebdomadaire (0 = dimanche, 1 = lundi…) */
  jourPesee: number
}

const PROFIL_DEFAUT: Profil = { poidsKg: 76, tailleCm: 179, fcMax: 204, jourPesee: 1 }

export const useProfil = () => useReglage<Profil>('profil', PROFIL_DEFAUT)
