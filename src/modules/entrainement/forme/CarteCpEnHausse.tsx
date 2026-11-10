import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { Aide } from '../../../core/ui/Aide'
import { Carte } from '../../../core/ui/Carte'
import { AIDES } from '../aides'
import { alerteCp } from '../analyse/progres'
import { genererSemaineVelo, lireMeta } from '../plan/programme'
import { lundiDe } from '../seances/donnees'
import { programmeDe, useReglagesEntrainement } from '../reglagesEntrainement'

/** Prochain dimanche à au moins 3 jours (le test complet se fait frais, le dimanche). */
function dimancheTest() {
  let d = decalerJour(aujourdhui(), 3)
  while (new Date(`${d}T12:00:00`).getDay() !== 0) d = decalerJour(d, 1)
  return d
}

/** Ta CP estimée dépasse nettement ta CP de test : on te demande si tu veux programmer un test (rien ne change sans toi). */
export function CarteCpEnHausse() {
  const a = useLiveQuery(alerteCp)
  const [r, modifier] = useReglagesEntrainement()
  if (!a) return null
  const prog = programmeDe(r.programme)
  const date = dimancheTest()
  const plusTard = () => enregistrer(db.reglages, { id: 'alerte-cp', valeur: { jusquau: decalerJour(aujourdhui(), 14) } })
  return (
    <Carte titre="Ta CP semble avoir progressé">
      <p className="text-sm text-texte-2">
        D'après tes meilleurs efforts des 6 dernières semaines : <b className="text-texte">~{a.estimee} W</b>, contre {a.cpW} W à ton dernier test.
        Ta CP ne change que si tu refais un test.
        <Aide titre="Estimation entre deux tests" texte={AIDES.cpEstimee} />
      </p>
      <p className="mt-2 font-semibold">Programmer un test CP le dimanche {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} ?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl bg-accent py-2.5 font-semibold text-fond" onClick={async () => {
          await modifier({ programme: { ...prog, testsCp: [...new Set([...prog.testsCp, date])].sort() } })
          if (await lireMeta(lundiDe(date))) await genererSemaineVelo(lundiDe(date)).catch(() => {})
          await plusTard()
        }}>Oui, programme-le</button>
        <button type="button" onClick={plusTard} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Non, pas maintenant</button>
      </div>
    </Carte>
  )
}
