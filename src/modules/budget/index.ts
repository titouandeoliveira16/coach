import type { ModuleApp } from '../../app/modules'
import { IconeArgent } from '../../core/ui/icones'
import { EcranBudget } from './EcranBudget'
import { ModeEmploiBudget } from './ModeEmploi'
import { SectionReglagesBudget } from './reglages/SectionReglagesBudget'

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
