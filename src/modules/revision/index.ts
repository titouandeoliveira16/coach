import type { ModuleApp } from '../../app/modules'
import { IconeRevision } from '../../core/ui/icones'
import { EcranRevision } from './EcranRevision'
import { ModeEmploiRevision } from './ModeEmploi'
import { SectionReglagesRevision } from './reglages/SectionReglagesRevision'

/** Déclaration du module Révision CAPEPS. */
export const moduleRevision: ModuleApp = {
  id: 'revision',
  nom: 'Révision CAPEPS',
  description: 'Notions, rappels, sujets',
  chemin: '/revision',
  couleur: '#60a5fa',
  Icone: IconeRevision,
  Ecran: EcranRevision,
  SectionReglages: SectionReglagesRevision,
  ModeEmploi: ModeEmploiRevision,
}
