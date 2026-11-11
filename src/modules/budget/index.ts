import { lazy } from 'react'
import type { ModuleApp } from '../../app/modules'
import { IconeArgent } from '../../core/ui/icones'
const EcranBudget = lazy(() => import('./EcranBudget').then((x) => ({ default: x.EcranBudget })))
const ModeEmploiBudget = lazy(() => import('./ModeEmploi').then((x) => ({ default: x.ModeEmploiBudget })))
const SectionReglagesBudget = lazy(() => import('./reglages/SectionReglagesBudget').then((x) => ({ default: x.SectionReglagesBudget })))

// Écrans chargés à la demande (audit du 11/11/2026) : ils ne pèsent plus au démarrage de l'appli
/** Déclaration du module Budget. */
export const moduleBudget: ModuleApp = {
  id: 'budget',
  nom: 'Budget',
  description: 'Dépenses, plafonds, patrimoine',
  chemin: '/budget',
  couleur: '#facc15',
  Icone: IconeArgent,
  Ecran: EcranBudget,
  SectionReglages: SectionReglagesBudget,
  ModeEmploi: ModeEmploiBudget,
}
