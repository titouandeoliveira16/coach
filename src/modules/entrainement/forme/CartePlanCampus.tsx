import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { ajouterPlanCampus, planDisponible, planFait } from '../plan/planCampus'

/** Carte unique : ajoute le plan Campus des 3 prochaines semaines et génère le vélo autour. */
export function CartePlanCampus() {
  const fait = useLiveQuery(planFait)
  const [occupe, setOccupe] = useState(false)
  const [termine, setTermine] = useState(false)
  if (termine)
    return (
      <Carte titre="📅 Plan ajouté">
        <p className="text-sm text-texte-2">Ta course et ton vélo sont placés jusqu'au 15/11.</p>
        <Link to="/entrainement/semaine" className="mt-2 block text-sm font-semibold text-accent">Voir ma semaine ›</Link>
      </Carte>
    )
  if (fait !== false || !planDisponible()) return null
  return (
    <Carte titre="📅 Ton plan Campus du 26/10 au 15/11">
      <ul className="space-y-1 text-sm text-texte-2">
        <li><b>Sem. 26/10</b> : lun. renfo · mar. test 1500 m · jeu. EF 45′ · sam. EF 1 h 10</li>
        <li><b>Sem. 02/11</b> : lun. EF 45′ · mer. renfo · jeu. 8 × 1′ seuil 30 · sam. EF 1 h 10</li>
        <li><b>Sem. 09/11</b> : lun. EF 25′ · mer. renfo · jeu. EF 25′ + sprints · sam. EF 50′</li>
      </ul>
      <p className="mt-2 text-xs text-texte-3">Le vélo est ensuite placé autour : une séance par jour, jamais deux jours durs d'affilée.</p>
      <Bouton className="mt-3" disabled={occupe} onClick={async () => {
        setOccupe(true)
        await ajouterPlanCampus()
        setOccupe(false)
        setTermine(true)
      }}>{occupe ? 'Placement…' : 'Ajouter ces 3 semaines'}</Bouton>
    </Carte>
  )
}
