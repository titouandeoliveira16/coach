import { lazy } from 'react'
import type { ModuleApp } from '../../app/modules'
import { IconeCatalogue } from '../../core/ui/icones'
const EcranCatalogue = lazy(() => import('./EcranCatalogue').then((x) => ({ default: x.EcranCatalogue })))

// Écrans chargés à la demande (audit du 11/11/2026) : ils ne pèsent plus au démarrage de l'appli
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
