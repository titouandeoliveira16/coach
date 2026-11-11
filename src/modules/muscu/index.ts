import { lazy } from 'react'
import type { ModuleApp } from '../../app/modules'
import { IconeMuscu } from '../../core/ui/icones'
const EcranMuscu = lazy(() => import('./EcranMuscu').then((x) => ({ default: x.EcranMuscu })))
const ModeEmploiMuscu = lazy(() => import('./ModeEmploi').then((x) => ({ default: x.ModeEmploiMuscu })))
const SectionReglagesMuscu = lazy(() => import('./reglages/SectionReglagesMuscu').then((x) => ({ default: x.SectionReglagesMuscu })))

// Écrans chargés à la demande (audit du 11/11/2026) : ils ne pèsent plus au démarrage de l'appli
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
