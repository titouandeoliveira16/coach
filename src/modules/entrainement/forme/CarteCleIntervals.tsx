import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../../core/db'
import { Carte } from '../../../core/ui/Carte'

/**
 * Clé Intervals.icu refusée (audit du 18/11/2026) : sans message, la VFC et le pouls de la montre n'arrivaient plus et le
 * feu se calculait sans eux.
 */
export function CarteCleIntervals() {
  const refusee = useLiveQuery(async () => !!((await db.reglages.get('intervals'))?.valeur as { cleRefusee?: boolean } | undefined)?.cleRefusee)
  if (!refusee) return null
  return (
    <Carte titre="Intervals.icu ne répond plus">
      <p className="text-sm text-texte-2">Ta clé Intervals.icu a été refusée : tes sorties, ta VFC et ton pouls de la nuit n'arrivent plus, et le feu se calcule sans ta montre.</p>
      <Link to="/entrainement/reglages" className="mt-2 inline-block font-semibold text-accent">Vérifier ma clé dans Réglages ›</Link>
    </Carte>
  )
}
