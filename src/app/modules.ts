import type { ComponentType } from 'react'
import { moduleBudget } from '../modules/budget'
import { moduleCatalogue } from '../modules/catalogue'
import { moduleEntrainement } from '../modules/entrainement'
import { moduleMuscu } from '../modules/muscu'
import { moduleRevision } from '../modules/revision'

/**
 * Description d'un module de l'appli (Entraînement, Nutrition…).
 * Pour ajouter un module : créer son dossier dans src/modules/
 * puis l'ajouter à la liste MODULES ci-dessous. Rien d'autre à modifier.
 */
export interface ModuleApp {
  id: string
  nom: string
  /** Une ligne sous le nom, sur l'accueil */
  description: string
  /** Module pas encore construit */
  bientot?: boolean
  /** Mis de côté : pas sur l'accueil (ses écrans restent accessibles, ex. le Catalogue depuis les réglages de l'Entraînement) */
  masque?: boolean
  /** Chemin de base, ex. "/entrainement" */
  chemin: string
  /** Couleur d'accent du module (code hexadécimal) */
  couleur: string
  Icone: ComponentType<{ className?: string }>
  /** Écran racine du module (il gère ses propres sous-écrans) */
  Ecran: ComponentType
  /** Réglages propres au module : écran Réglages du module (le compte et les notifications sont dans Accueil → ⚙️) */
  SectionReglages?: ComponentType
  /** Mode d'emploi du module (facultatif) */
  ModeEmploi?: ComponentType
}

export const MODULES: ModuleApp[] = [
  moduleEntrainement,
  moduleRevision,
  moduleBudget,
  // Mis de côté le 3/11/2026 (demande de Titouan) : plus sur l'accueil
  { ...moduleMuscu, masque: true },
  { ...moduleCatalogue, masque: true },
  // Plus tard : moduleNutrition
]
