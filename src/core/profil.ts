import { useReglage } from './reglages'

/** Profil commun à tous les modules (l'entraînement comme la nutrition s'en servent). */
export interface Profil {
  poidsKg?: number
  tailleCm?: number
  fcMax?: number
}

const PROFIL_DEFAUT: Profil = { poidsKg: 76, tailleCm: 179, fcMax: 204 }

export const useProfil = () => useReglage<Profil>('profil', PROFIL_DEFAUT)
