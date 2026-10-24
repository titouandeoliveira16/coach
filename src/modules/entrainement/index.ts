import type { ModuleApp } from '../../app/modules'
import { IconeEntrainement } from '../../core/ui/icones'
import { EcranEntrainement } from './EcranEntrainement'
import { SectionReglagesEntrainement } from './reglages/SectionReglages'

/** Déclaration du module Entraînement auprès de l'appli. */
export const moduleEntrainement: ModuleApp = {
  id: 'entrainement',
  nom: 'Entraînement',
  description: 'Vélo, course, forme du jour',
  chemin: '/entrainement',
  couleur: '#ff8a3d',
  Icone: IconeEntrainement,
  Ecran: EcranEntrainement,
  SectionReglages: SectionReglagesEntrainement,
}
