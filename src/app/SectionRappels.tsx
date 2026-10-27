import { useEffect, useState } from 'react'
import { abonnementActuel, activerRappels, desactiverRappels, notificationsPossibles, testerRappels } from '../core/notifications'
import { useSynchro } from '../core/synchro'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

/** Notifications sur cet appareil (activer, tester, désactiver). Les rappels eux-mêmes se règlent dans chaque module. */
export function SectionRappels() {
  const { session } = useSynchro()
  const [actifs, setActifs] = useState<boolean>()
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()

  useEffect(() => {
    abonnementActuel().then((a) => setActifs(!!a)).catch(() => setActifs(false))
  }, [])

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
    <Carte titre="Notifications">
      <p className="text-sm text-texte-2">Active les notifications sur ce téléphone. Chaque module règle ses propres rappels dans ses réglages (Entraînement : matin et pesée ; Budget : saisie du soir).</p>
      {!notificationsPossibles() ? (
        <p className="mt-2 text-sm text-texte-2">Ouvre l'appli depuis l'écran d'accueil de l'iPhone pour activer les rappels.</p>
      ) : !session ? (
        <p className="mt-2 text-sm text-texte-2">Connecte-toi à ton compte (juste au-dessus) pour activer les notifications.</p>
      ) : actifs ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-nutrition">✓ Rappels activés sur cet appareil</p>
          <Bouton variante="secondaire" disabled={occupe} onClick={() => agir(async () => {
            const r = await testerRappels()
            return r.envoyes ? 'Notification de test envoyée.' : "Aucune notification envoyée : désactive puis réactive les rappels."
          })}>Envoyer une notification de test</Bouton>
          <button type="button" className="w-full py-2 text-sm text-texte-3" disabled={occupe}
            onClick={() => agir(async () => { await desactiverRappels(); setActifs(false) })}>Désactiver sur cet appareil</button>
        </div>
      ) : (
        <Bouton className="mt-3" disabled={occupe} onClick={() => agir(async () => {
          await activerRappels()
          setActifs(true)
          return '✓ Rappels activés. Touche « Envoyer une notification de test » pour vérifier.'
        })}>{occupe ? 'Activation…' : 'Activer les rappels'}</Bouton>
      )}
      {message && <p className="mt-2 text-sm text-texte-2">{message}</p>}
    </Carte>
  )
}
