import type { ComponentType } from 'react'
import { moduleEntrainement } from '../modules/entrainement'

/**
 * Description d'un module de l'appli (Entraînement, Nutrition…).
 * Pour ajouter un module : créer son dossier dans src/modules/
 * puis l'ajouter à la liste MODULES ci-dessous. Rien d'autre à modifier.
 */
export interface ModuleApp {
  id: string
  nom: string
  /** Chemin de base, ex. "/entrainement" */
  chemin: string
  /** Couleur d'accent du module (code hexadécimal) */
  couleur: string
  Icone: ComponentType<{ className?: string }>
  /** Écran racine du module (il gère ses propres sous-écrans) */
  Ecran: ComponentType
}

export const MODULES: ModuleApp[] = [
  moduleEntrainement,
  // Plus tard : moduleNutrition, moduleApprentissage, moduleArgent
]
