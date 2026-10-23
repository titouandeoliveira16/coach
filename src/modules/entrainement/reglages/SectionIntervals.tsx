import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../core/db'
import { depuis } from '../../../core/format'
import { useSynchro } from '../../../core/synchro'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { delierIntervals, etatIntervalsServeur, importerIntervals, relierIntervals, type EtatIntervals } from '../import/intervals'

const champ = 'w-full rounded-xl border border-bordure bg-surface-2 px-4 py-3 outline-none focus:border-accent'

/** Intervals.icu : import automatique des séances et des données Garmin (VFC, FC de repos, sommeil, poids). */
export function SectionIntervals() {
  const { session } = useSynchro()
  const etat = useLiveQuery(async () => ((await db.reglages.get('intervals'))?.valeur as EtatIntervals | undefined) ?? {})
  const [connecte, setConnecte] = useState<boolean>()
  const [cle, setCle] = useState('')
  const [athlete, setAthlete] = useState('')
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    if (session) etatIntervalsServeur().then((e) => setConnecte(e.connecte)).catch((e) => setMessage((e as Error).message))
  }, [session])

  const agir = async (action: () => Promise<string | void>) => {
    setOccupe(true)
    setMessage(undefined)
    try {
      const m = await action()
      if (m) setMessage(m)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setOccupe(false)
    }
  }

  const importer = () =>
    agir(async () => {
      const r = await importerIntervals((n) => setMessage(`${n} séance(s) importée(s)…`))
      const morceaux = [`✓ ${r.seances} séance(s)`, `${r.mesures} jour(s) de données Garmin`]
      const strava = r.viaStrava ? ` · ${r.viaStrava} activité(s) venant de Strava ignorée(s) : relie Garmin et Zwift directement à Intervals.` : ''
      return `${morceaux.join(' et ')} importé(s).${strava}`
    })

  return (
    <Carte titre="Intervals.icu">
      {!session ? (
        <p className="text-sm text-texte-2">Connecte-toi à ton compte (en haut de Réglages) pour relier Intervals.icu.</p>
      ) : connecte ? (
        <div className="space-y-2">
          <p className="text-sm text-nutrition">✓ Intervals.icu relié{etat?.dernierImport ? ` · dernier import ${depuis(etat.dernierImport)}` : ''}</p>
          <Bouton disabled={occupe} onClick={importer}>
            {occupe ? 'Import en cours…' : etat?.dernierImport ? 'Synchroniser maintenant' : 'Importer mes 3 derniers mois'}
          </Bouton>
          <button type="button" className="w-full py-2 text-sm text-texte-3" disabled={occupe}
            onClick={() => confirm('Délier Intervals.icu ? Les données déjà importées restent.') && agir(async () => { await delierIntervals(); setConnecte(false) })}>
            Délier Intervals.icu
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-texte-2">
            Importe automatiquement tes séances (Garmin, Zwift…) et les données de ta montre : VFC, FC de repos, sommeil, poids.
            Ta clé reste chiffrée sur le serveur, jamais dans l'appli. Aucune trace GPS n'est récupérée.
          </p>
          <input placeholder="Clé API (Settings → Developer Settings)" value={cle} onChange={(e) => setCle(e.target.value)}
            autoComplete="off" autoCapitalize="off" spellCheck={false} className={champ} />
          <input placeholder="ID athlète, ex. i123456 (facultatif)" value={athlete} onChange={(e) => setAthlete(e.target.value)}
            autoComplete="off" autoCapitalize="off" spellCheck={false} className={champ} />
          <Bouton disabled={occupe || cle.trim().length < 10} onClick={() => agir(async () => {
            const r = await relierIntervals(cle.trim(), athlete.trim() || undefined)
            setConnecte(true)
            setCle('')
            return `✓ Relié${r.nom ? ` au compte de ${r.nom}` : ''}. Lance maintenant l'import.`
          })}>
            {occupe ? 'Vérification…' : 'Relier Intervals.icu'}
          </Bouton>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Carte>
  )
}
