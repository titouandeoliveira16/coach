import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../../core/db'
import { depuis } from '../../../core/format'
import { useSynchro } from '../../../core/synchro'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import { connecterStrava, deconnecterStrava, etatStravaServeur, importerStrava, type EtatStrava } from '../import/strava'

/** Connexion Strava : import automatique des activités (iGPSPORT, Zwift, Garmin → Strava → Coach). */
export function SectionStrava() {
  const { session } = useSynchro()
  const etat = useLiveQuery(async () => ((await db.reglages.get('strava'))?.valeur as EtatStrava | undefined) ?? {})
  const [connecte, setConnecte] = useState<boolean>()
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()

  const verifier = () => {
    if (session) etatStravaServeur().then((e) => setConnecte(e.connecte)).catch((e) => setMessage((e as Error).message))
  }
  useEffect(() => {
    verifier()
    // Au retour de la page Strava (Safari), on revérifie
    const auRetour = () => document.visibilityState === 'visible' && verifier()
    document.addEventListener('visibilitychange', auRetour)
    return () => document.removeEventListener('visibilitychange', auRetour)
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

  return (
    <Carte titre="Strava">
      {!session ? (
        <p className="text-sm text-texte-2">Connecte-toi à ton compte (en haut de Réglages) pour relier Strava.</p>
      ) : connecte ? (
        <div className="space-y-2">
          <p className="text-sm text-nutrition">✓ Strava connecté{etat?.dernierImport ? ` · dernier import ${depuis(etat.dernierImport)}` : ''}</p>
          <Bouton disabled={occupe} onClick={() => agir(async () => {
            const n = await importerStrava((x) => setMessage(`${x} séance(s) importée(s)…`))
            return n ? `✓ ${n} séance(s) importée(s).` : 'Rien de nouveau sur Strava.'
          })}>
            {occupe ? 'Import en cours…' : etat?.curseur ? 'Synchroniser Strava' : 'Importer mes 3 derniers mois'}
          </Bouton>
          <button type="button" className="w-full py-2 text-sm text-texte-3" disabled={occupe}
            onClick={() => confirm('Déconnecter Strava ? Les séances déjà importées restent.') && agir(async () => { await deconnecterStrava(); setConnecte(false) })}>
            Déconnecter Strava
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-texte-2">
            Relie Strava pour importer automatiquement tes séances (iGPSPORT, Zwift et ta Garmin s'y synchronisent déjà).
            Les traces GPS ne sont jamais récupérées.
          </p>
          <Bouton disabled={occupe || connecte === undefined} onClick={() => agir(connecterStrava)}>Connecter Strava</Bouton>
          <p className="text-xs text-texte-3">Strava s'ouvre dans Safari : autorise l'accès, puis reviens ici.</p>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Carte>
  )
}
