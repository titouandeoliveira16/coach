import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui } from '../../../core/dates'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { Carte } from '../../../core/ui/Carte'
import { seancesClesSautees } from '../plan/programme'
import { lundiDe } from '../seances/donnees'

/** Séance d'intensité ou séance au 1er seuil pas faite 2 semaines de suite : un rappel, une fois par semaine. */
export function CarteSeancesCles() {
  const lundi = lundiDe(aujourdhui())
  const etat = useLiveQuery(async () => {
    const vue = (await db.reglages.get('alerte-seances-cles'))?.valeur as { lundi?: string } | undefined
    return vue?.lundi === lundi ? [] : await seancesClesSautees(lundi)
  }, [lundi])
  if (!etat?.length) return null
  const quoi = etat.length === 2 ? 'Ta séance d’intensité et ta séance au 1er seuil n’ont' : etat[0] === 'intensite' ? 'Ta séance d’intensité n’a' : 'Ta séance au 1er seuil n’a'
  return (
    <Carte titre="Deux semaines sans ta séance clé">
      <p className="text-sm text-texte-2">
        {quoi} pas été faite{etat.length === 2 ? 's' : ''} les 2 dernières semaines. C’est elle qui te fait progresser : cette semaine, garde-la en priorité.
        Si le jour ne colle plus avec ton emploi du temps, change-le dans Réglages → Ma semaine type.
      </p>
      <button type="button" onClick={() => enregistrer(db.reglages, { id: 'alerte-seances-cles', valeur: { lundi } })} className="mt-3 w-full rounded-xl border border-bordure py-2.5 font-semibold text-texte-2">Compris</button>
    </Carte>
  )
}
