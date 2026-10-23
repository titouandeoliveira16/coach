import { useReglage } from './reglages'

/** Profil commun à tous les modules (l'entraînement comme la nutrition s'en servent). */
export interface Profil {
  /** Mis à jour automatiquement à chaque pesée */
  poidsKg?: number
  fcMax?: number
}

const PROFIL_DEFAUT: Profil = { poidsKg: 76, fcMax: 204 }

export const useProfil = () => useReglage<Profil>('profil', PROFIL_DEFAUT)
