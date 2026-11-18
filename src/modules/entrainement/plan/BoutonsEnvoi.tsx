import { useState } from 'react'
import type { Etape } from '../../../metrics/programme'
import { envoyerSeance, retirerSeance, useEnvoi, type Cible } from '../import/envoi'
import type { SeancePrevue } from '../types'
import { useReglage } from '../../../core/reglages'
import { envoyerSeanceIgpsport, type EnvoiIgpsport } from '../import/igpsport'
import { avecZwift, libelleEnvoiMontre } from '../appareils'
import type { ProfilSportif } from '../reglages/ProfilSportif'

const NOMS: Record<Cible, string> = { garmin: 'ta montre / ton compteur', zwift: 'Zwift' }

/** « Envoyer à Garmin » / « Envoyer à Zwift » : la séance part dans ton calendrier Intervals.icu, qui la transmet. */
export function BoutonsEnvoi({ p, etapes }: { p: SeancePrevue; etapes: Etape[] }) {
  const envoi = useEnvoi(p.id)
  const [igp] = useReglage<EnvoiIgpsport>('igpsport-envoi', {})
  // Boutons nommés d'après ton matériel (16/11/2026) : « Envoyer à ma COROS », Zwift seulement si tu l'as
  const [ps] = useReglage<Partial<ProfilSportif>>('profil-sportif', {})
  const montre = libelleEnvoiMontre(ps.appareils)
  // Pas de Zwift pour une séance dehors, sur le terrain (VTT technique, spéciales)
  const zwift = avecZwift(ps.appareils) && !['vtt-terrain', 'vtt-speciales'].includes(p.velo?.famille ?? '')
  const envoyeCompteur = igp.envois?.[p.id]
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
            Envoyée à {NOMS[envoi.cible]} le {new Date(envoi.le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })}
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, envoi.cible), 'Mise à jour envoyée ✓')}>↻ Renvoyer</button>
            <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => retirerSeance(p), 'Retirée ✓')}>Retirer</button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          {montre && <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, 'garmin'), 'Envoyée ✓ Intervals.icu la transmet à ta montre ou ton compteur (« Upload planned workouts » coché) : elle arrive à la prochaine synchro.')}>{montre}</button>}
          {zwift && <button type="button" disabled={occupe} className={bouton} onClick={() => agir(() => envoyerSeance(p, etapes, 'zwift'), 'Envoyée ✓ Zwift → Workouts → Custom → Intervals.icu.')}>Envoyer à Zwift</button>}
        </div>
      )}
      {/* Compteur iGPSPORT (16/11/2026) : seulement quand tu le demandes */}
      {igp.relie && (
        <button type="button" disabled={occupe} className={`${bouton} mt-2 w-full`}
          onClick={() => agir(() => envoyerSeanceIgpsport(p, etapes), 'Envoyée ✓ Ouvre l’appli iGPSPORT (compteur appairé) : elle est dans tes entraînements, au nom de son jour.')}>
          {envoyeCompteur ? `↻ Renvoyer à mon compteur (envoyée le ${new Date(envoyeCompteur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' })})` : 'Envoyer à mon compteur (iGPSPORT)'}
        </button>
      )}
      {occupe && <p className="mt-1 text-xs text-texte-3">Envoi…</p>}
      {message && <p className="mt-1 text-xs text-texte-3">{message}</p>}
    </div>
  )
}
