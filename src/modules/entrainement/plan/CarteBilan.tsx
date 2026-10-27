import { useLiveQuery } from 'dexie-react-hooks'
import { depuisJour } from '../../../core/dates'
import { Carte } from '../../../core/ui/Carte'
import { bilanDimanche } from './programme'

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
