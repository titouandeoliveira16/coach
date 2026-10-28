import type { ModuleApp } from '../../app/modules'
import { IconeMuscu } from '../../core/ui/icones'
import { EcranMuscu } from './EcranMuscu'
import { ModeEmploiMuscu } from './ModeEmploi'
import { SectionReglagesMuscu } from './reglages/SectionReglagesMuscu'

/** Déclaration du module Muscu (développé couché, méthode 5/3/1). */
export const moduleMuscu: ModuleApp = {
  id: 'muscu',
  nom: 'Muscu',
  description: 'Développé couché, méthode 5/3/1',
  chemin: '/muscu',
  couleur: '#a78bfa',
  Icone: IconeMuscu,
  Ecran: EcranMuscu,
  SectionReglages: SectionReglagesMuscu,
  ModeEmploi: ModeEmploiMuscu,
}
