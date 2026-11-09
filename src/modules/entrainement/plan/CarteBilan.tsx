import { useLiveQuery } from 'dexie-react-hooks'
import { decalerJour, depuisJour } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { dimancheDuBilan } from '../forme/bilanNutrition'
import { bilanDimanche } from './programme'

/** Semaine dont le bilan s'affiche : celle qui finit, le dimanche (Aujourd'hui) et le lundi (rappel dans Semaine).
 *  Jamais avant le dimanche, plus rien après le lundi. */
export function lundiDuBilan(jour?: string) {
  const dimanche = dimancheDuBilan(jour)
  return dimanche && decalerJour(dimanche, -6)
}

/** Bilan de la semaine en 3 lignes : fait, ce qui change, pourquoi. */
export function CarteBilan({ lundi, deps = [] }: { lundi: string; deps?: unknown[] }) {
  const b = useLiveQuery(() => bilanDimanche(lundi), [lundi, ...deps])
  if (!b) return null
  return (
    <Carte titre={`Bilan de la semaine du ${depuisJour(lundi).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}>
      <div className="space-y-2 text-sm">
        <p><b>✅ Fait :</b> <span className="text-texte-2">{b.fait}</span></p>
        <p><b>➡️ Semaine prochaine :</b> <span className="text-texte-2">{b.change}</span></p>
        <p><b>💡 Pourquoi :</b> <span className="text-texte-2">{b.pourquoi}</span></p>
      </div>
    </Carte>
  )
}
