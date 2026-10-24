import type { ModuleApp } from '../../app/modules'
import { IconeArgent } from '../../core/ui/icones'
import { EcranArgent } from './EcranArgent'

/** Déclaration du module Argent (à construire). */
export const moduleArgent: ModuleApp = {
  id: 'argent',
  nom: 'Argent',
  description: 'Bientôt',
  bientot: true,
  chemin: '/argent',
  couleur: '#facc15',
  Icone: IconeArgent,
  Ecran: EcranArgent,
}
