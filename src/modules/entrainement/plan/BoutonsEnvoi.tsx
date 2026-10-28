import { useState } from 'react'
import type { Etape } from '../../../metrics/programme'
import { envoyerSeance, retirerSeance, useEnvoi, type Cible } from '../import/envoi'
import type { SeancePrevue } from '../types'

const NOMS: Record<Cible, string> = { garmin: 'ta montre (Garmin)', zwift: 'Zwift' }

/** « Envoyer à Garmin » / « Envoyer à Zwift » : la séance part dans ton calendrier Intervals.icu, qui la transmet. */
export function BoutonsEnvoi({ p, etapes }: { p: SeancePrevue; etapes: Etape[] }) {
  const envoi = useEnvoi(p.id)
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  if (envoi === undefined) return null

  const agir = async (f: () => Promise<void>, ok: string) => {
    setOccupe(true)
    setMessage(undefined)
    try {
      await f()
      setMessage(ok)
    } catch (e) {
      setMessage(`Échec : ${(e as Error).message}`)
    } finally {
      setOccupe(false)
    }
  }
  const bouton = 'flex-1 rounded-xl border border-bordure bg-surface-2 py-2.5 text-sm font-semibold disabled:opacity-40'

  return (
    <div className="mt-3">
      {envoi ? (
        <>
          <p className="text-sm text-texte-2">
            ✅ Envoyée à {NOMS[envoi.cible]} le {new Date(envoi.le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, envoi.cible), 'Mise à jour envoyée ✓')}>↻ Renvoyer</button>
            <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => retirerSeance(p), 'Retirée ✓')}>Retirer</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, 'garmin'), 'Envoyée ✓ Elle arrive sur ta montre après la synchro Garmin Connect.')}>⌚ Envoyer à Garmin</button>
          <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, 'zwift'), 'Envoyée ✓ Zwift → Workouts → Custom → Intervals.icu.')}>🖥️ Envoyer à Zwift</button>
        </div>
      )}
      {occupe && <p className="mt-1 text-xs text-texte-3">Envoi…</p>}
      {message && <p className="mt-1 text-xs text-texte-3">{message}</p>}
    </div>
  )
}
