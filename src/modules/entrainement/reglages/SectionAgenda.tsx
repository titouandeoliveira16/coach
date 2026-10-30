import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { URL_SUPABASE } from '../../../core/supabase'
import { useSynchro } from '../../../core/synchro'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'

/** Clé secrète du lien d'agenda (32 caractères hexadécimaux). */
const nouvelleCle = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (o) => o.toString(16).padStart(2, '0')).join('')

/** Google Agenda : un lien iCal privé avec les séances prévues (fonction serveur « agenda »), mis à jour tout seul. */
export function SectionAgenda() {
  const { session } = useSynchro()
  const cle = useLiveQuery(async () => ((await db.reglages.get('agenda'))?.valeur as { cle?: string } | undefined)?.cle ?? null)
  const [message, setMessage] = useState<string>()
  if (cle === undefined) return null
  const lien = cle ? `${URL_SUPABASE}/functions/v1/agenda?cle=${cle}` : undefined
  const creer = async () => {
    await enregistrer(db.reglages, { id: 'agenda', valeur: { cle: nouvelleCle() } })
    setMessage(undefined)
  }

  return (
    <Carte titre="📅 Google Agenda">
      {!session ? (
        <p className="text-sm text-texte-2">Connecte-toi à ton compte (Accueil → ⚙️) : le lien lit tes séances sauvegardées en ligne.</p>
      ) : !lien ? (
        <>
          <p className="mb-2 text-sm text-texte-2">Tes séances prévues dans Google Agenda, en journée entière, mises à jour toutes seules quand tu les changes ici.</p>
          <Bouton onClick={creer}>Créer mon lien d'agenda</Bouton>
        </>
      ) : (
        <div className="space-y-2 text-sm text-texte-2">
          <p className="break-all rounded-xl bg-surface-2 p-2.5 font-mono text-xs text-texte">{lien}</p>
          <Bouton onClick={async () => { await navigator.clipboard.writeText(lien); setMessage('Lien copié ✓') }}>Copier le lien</Bouton>
          {message && <p className="text-nutrition">{message}</p>}
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>Sur un ordinateur, ouvre <b className="text-texte">calendar.google.com</b>.</li>
            <li>À gauche, « Autres agendas » → <b className="text-texte">+</b> → <b className="text-texte">À partir de l'URL</b>.</li>
            <li>Colle le lien → « Ajouter l'agenda ». Il apparaît aussi sur ton téléphone.</li>
          </ol>
          <p className="text-xs text-texte-3">Google relit le lien toutes les quelques heures : un changement fait ici y arrive avec un peu de retard. Garde ce lien pour toi : il donne accès à tes séances.</p>
          <button type="button" className="w-full py-2 text-texte-3"
            onClick={() => confirm('Changer le lien ? L\'ancien ne marchera plus : il faudra ajouter le nouveau dans Google Agenda.') && creer()}>
            Changer le lien
          </button>
        </div>
      )}
    </Carte>
  )
}
