import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { alerteCp } from '../analyse/progres'

/** Ta CP estimée (meilleurs efforts) dépasse nettement ta CP de test : avancer le prochain test. */
export function CarteCpEnHausse() {
  const a = useLiveQuery(alerteCp)
  if (!a) return null
  return (
    <Carte titre="📈 Ta CP semble avoir progressé">
      <p className="text-sm text-texte-2">
        D'après tes meilleurs efforts des 6 dernières semaines : <b className="text-texte">~{a.estimee} W</b>, contre {a.cpW} W à ton dernier test.
        Avance ton prochain test pour recaler tes zones et les watts de tes séances.
        <Aide titre="Estimation entre deux tests" texte={AIDES.cpEstimee} />
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to="/entrainement/progres" className="rounded-xl bg-accent py-2.5 text-center font-semibold text-fond">Mes tests</Link>
        <button type="button" onClick={() => enregistrer(db.reglages, { id: 'alerte-cp', valeur: { jusquau: decalerJour(aujourdhui(), 14) } })}
          className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Plus tard</button>
      </div>
    </Carte>
  )
}
