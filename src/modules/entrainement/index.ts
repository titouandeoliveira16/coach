import { lazy } from 'react'
import type { ModuleApp } from '../../app/modules'
import { IconeEntrainement } from '../../core/ui/icones'
import { EcranEntrainement } from './EcranEntrainement'
import { SectionReglagesEntrainement } from './reglages/SectionReglages'

const ModeEmploiEntrainement = lazy(() => import('./ModeEmploi').then((x) => ({ default: x.ModeEmploi })))

/** Déclaration du module Entraînement auprès de l'appli. */
export const moduleEntrainement: ModuleApp = {
  id: 'entrainement',
  nom: 'Entraînement',
  description: 'Vélo, forme du jour',
  chemin: '/entrainement',
  couleur: '#ff8a3d',
  Icone: IconeEntrainement,
  Ecran: EcranEntrainement,
  SectionReglages: SectionReglagesEntrainement,
  // Mode d'emploi : en haut des Réglages, comme les autres modules (retiré de la barre du bas le 5/11/2026)
  ModeEmploi: ModeEmploiEntrainement,
}
