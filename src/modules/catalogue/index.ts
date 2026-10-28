import type { ModuleApp } from '../../app/modules'
import { IconeCatalogue } from '../../core/ui/icones'
import { EcranCatalogue } from './EcranCatalogue'

/** Déclaration du module Catalogue (séances appuyées sur la science, pas encore reliées au reste). */
export const moduleCatalogue: ModuleApp = {
  id: 'catalogue',
  nom: 'Catalogue',
  description: 'Séances appuyées sur la science',
  chemin: '/catalogue',
  couleur: '#2dd4bf',
  Icone: IconeCatalogue,
  Ecran: EcranCatalogue,
}
