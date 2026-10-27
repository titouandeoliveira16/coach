import { conseilsSeance } from '../../../metrics/nutritionSeance'
import { Aide } from '../../../core/ui/Aide'
import { AIDES } from '../aides'
import type { SeancePrevue } from '../types'

/** Repères de nutrition d'une séance : avant, pendant, boire, après. */
export function NutritionSeance({ p }: { p: SeancePrevue }) {
  const c = conseilsSeance({ sport: p.sport, dureeMin: p.dureeMin, intensite: p.intensite, test: p.velo?.famille === 'test' })
  const lignes = [
    ...(c.avant ? [['🍽️ Avant', c.avant]] : []),
    ['🍌 Pendant', c.pendant],
    ['💧 Boire', c.hydratation],
    ['🥛 Après', c.apres],
  ]
  return (
    <div className="mt-2 rounded-xl bg-surface-2 p-2.5 text-sm">
      <p className="mb-1 text-xs uppercase tracking-wider text-texte-3">Nutrition<Aide titre="Nutrition de la séance" texte={AIDES.nutritionSeance} /></p>
      <ul className="space-y-1">
        {lignes.map(([titre, texte]) => (
          <li key={titre}><b>{titre} :</b> <span className="text-texte-2">{texte}</span></li>
        ))}
      </ul>
    </div>
  )
}
