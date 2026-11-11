import { lazy } from 'react'
import type { ModuleApp } from '../../app/modules'
import { IconeRevision } from '../../core/ui/icones'
const EcranRevision = lazy(() => import('./EcranRevision').then((x) => ({ default: x.EcranRevision })))
const ModeEmploiRevision = lazy(() => import('./ModeEmploi').then((x) => ({ default: x.ModeEmploiRevision })))
const SectionReglagesRevision = lazy(() => import('./reglages/SectionReglagesRevision').then((x) => ({ default: x.SectionReglagesRevision })))

// Écrans chargés à la demande (audit du 11/11/2026) : ils ne pèsent plus au démarrage de l'appli
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
