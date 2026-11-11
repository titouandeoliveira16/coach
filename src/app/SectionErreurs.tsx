import { useEffect, useState } from 'react'
import { dernieresErreurs, marquerErreursVues, type ErreurServeur } from '../core/erreurs'
import { useSynchro } from '../core/synchro'
import { Repliable } from '../core/ui/Repliable'

const quand = (d: string) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/**
 * Coach seulement : erreurs de l'appli sur tous les comptes (le serveur ne les montre qu'aux coachs). Tu en es aussi
 * prévenu par notification ; envoie-les à Claude pour qu'il corrige.
 */
export function SectionErreurs() {
  const { session } = useSynchro()
  const [erreurs, setErreurs] = useState<ErreurServeur[]>()
  const [indispo, setIndispo] = useState(false)
  useEffect(() => {
    dernieresErreurs().then(setErreurs).catch(() => setIndispo(true))
  }, [])
  if (!erreurs && !indispo) return null
  const nouvelles = erreurs?.filter((e) => !e.vue).length ?? 0
  return (
    <Repliable titre="Erreurs de l'appli" libelle="Voir"
      resume={indispo ? 'Pas encore installé (script SQL 07)' : nouvelles ? `${nouvelles} nouvelle${nouvelles > 1 ? 's' : ''}` : 'Aucune nouvelle erreur'}>
      {indispo ? (
        <p className="text-sm text-texte-2">Exécute le script `supabase/sql/07-erreurs.sql` dans Supabase pour recevoir les erreurs de tous les comptes.</p>
      ) : !erreurs?.length ? (
        <p className="text-sm text-texte-2">Aucune erreur enregistrée.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {erreurs.map((e) => (
              <li key={e.id} className={`rounded-xl bg-surface-2 p-2.5 text-sm ${e.vue ? 'opacity-60' : ''}`}>
                <p className="text-xs text-texte-3">{quand(e.le)} · v{e.version} · {e.page} · {e.user_id === session?.user.id ? 'ton compte' : `compte ${e.user_id.slice(0, 4)}`}</p>
                <p className="mt-0.5 break-words">{e.message}</p>
              </li>
            ))}
          </ul>
          {nouvelles > 0 && (
            <button type="button" className="mt-2 w-full py-2 text-sm font-semibold text-accent" onClick={async () => {
              await marquerErreursVues()
              setErreurs(erreurs.map((e) => ({ ...e, vue: true })))
            }}>Tout marquer comme vu</button>
          )}
        </>
      )}
    </Repliable>
  )
}
