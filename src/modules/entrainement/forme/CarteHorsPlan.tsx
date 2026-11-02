import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { aujourdhui } from '../../../core/dates'
import { db } from '../../../core/db'
import { formatNombre } from '../../../core/format'
import { enregistrer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { genererSemaineVelo, lireMeta } from '../plan/programme'
import { lundiDe } from '../seances/donnees'

const CLE = 'hors-plan-vus'

/**
 * Sortie vélo faite hors plan cette semaine (après la génération de la semaine) : ses kJ comptent déjà ;
 * on propose de recalculer la fin de la semaine pour rester dans le budget (Système kJ, « mode libre »).
 */
export function CarteHorsPlan() {
  const [message, setMessage] = useState<string>()
  const hors = useLiveQuery(async () => {
    const lundi = lundiDe(aujourdhui())
    const meta = await lireMeta(lundi)
    if (!meta) return null
    const vus = ((await db.reglages.get(CLE))?.valeur as string[] | undefined) ?? []
    const seances = (await db.seances.where('date').between(lundi, aujourdhui(), true, true).toArray())
      .filter((s) => s.sport === 'velo' && !s.prevueId && s.date >= meta.genereeLe.slice(0, 10) && !vus.includes(s.id))
    return seances.length ? { lundi, seances, vus } : null
  })
  if (message) return <Carte titre="🚲 Semaine recalculée"><p className="text-sm text-texte-2">{message}</p></Carte>
  if (!hors) return null
  const kj = hors.seances.reduce((a, s) => a + (s.kj ?? 0), 0)
  const marquer = () => enregistrer(db.reglages, { id: CLE, valeur: [...hors.vus, ...hors.seances.map((s) => s.id)].slice(-50) })
  return (
    <Carte titre="🚲 Sortie hors plan">
      <p className="text-sm text-texte-2">
        {hors.seances.map((s) => s.titre ?? 'Sortie vélo').join(', ')}{kj ? ` : ${formatNombre(kj)} kJ` : ''}, déjà comptés dans ton budget.
        Recalculer la fin de ta semaine pour rester dans ton budget ?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="rounded-xl bg-accent py-2.5 font-semibold text-fond" onClick={async () => {
          const phrases = await genererSemaineVelo(hors.lundi).catch((e: Error) => [e.message])
          await marquer()
          setMessage(`${phrases.join(' ')} Si tu avais déjà envoyé des séances à Zwift ou Garmin, renvoie-les.`)
        }}>Recalculer</button>
        <button type="button" onClick={marquer} className="rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Garder ma semaine</button>
      </div>
    </Carte>
  )
}
