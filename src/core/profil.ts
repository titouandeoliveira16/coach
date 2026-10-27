import { useReglage } from './reglages'

/** Profil commun à tous les modules (l'entraînement comme la nutrition s'en servent). */
export interface Profil {
  /** Mis à jour automatiquement à chaque pesée */
  poidsKg?: number
  fcMax?: number
  /** Taille (cm) et date de naissance : métabolisme de base (besoins du jour) */
  tailleCm?: number
  naissance?: string
  /** Objectif nutritionnel : garder son poids, ou perte de gras légère */
  objectif?: 'maintien' | 'perte'
}

/** Valeurs neutres tant que le profil n'est pas rempli (les vraies valeurs vivent dans tes données, jamais dans le code). */
export const PROFIL_DEFAUT: Profil = { poidsKg: 70, fcMax: 190, tailleCm: 175 }
/** Âge utilisé tant que la date de naissance n'est pas renseignée */
export const AGE_DEFAUT = 30

/** Âge (années révolues) à une date. */
export function ageAu(naissance: string, jour: string) {
  const [an, mois, j] = naissance.split('-').map(Number)
  const [an2, mois2, j2] = jour.split('-').map(Number)
  return an2 - an - (mois2 < mois || (mois2 === mois && j2 < j) ? 1 : 0)
}

export const useProfil = () => useReglage<Profil>('profil', PROFIL_DEFAUT)
