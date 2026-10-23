import { useEffect, useState } from 'react'
import { abonnementActuel, activerRappels, desactiverRappels, notificationsPossibles, testerRappels } from '../core/notifications'
import { useSynchro } from '../core/synchro'
import { Bouton } from '../core/ui/Bouton'
import { Carte } from '../core/ui/Carte'

/** Rappels par notification : matin, pesée. */
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
    <Carte titre="Rappels">
      <ul className="space-y-1 text-sm text-texte-2">
        <li>☀️ Chaque matin à 8 h 30 : ton matin (FC de repos, VFC, sommeil, notes)</li>
        <li>⚖️ Le mardi à 8 h 30 : la pesée (et samedi 24/10 exceptionnellement)</li>
      </ul>
      <p className="mt-1 text-xs text-texte-3">Pas de rappel si c'est déjà fait.</p>

      {!notificationsPossibles() ? (
        <p className="mt-2 text-sm text-texte-2">Ouvre l'appli depuis l'écran d'accueil de l'iPhone pour activer les rappels.</p>
      ) : !session ? (
        <p className="mt-2 text-sm text-texte-2">Connecte-toi à ton compte (en haut de Réglages) pour activer les rappels.</p>
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
