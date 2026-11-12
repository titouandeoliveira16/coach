import { useEffect, useState } from 'react'
import { db } from '../../../core/db'
import { abonnementActuel, activerRappels, notificationsPossibles } from '../../../core/notifications'
import { enregistrer } from '../../../core/stockage'
import { Bouton } from '../../../core/ui/Bouton'
import { Carte } from '../../../core/ui/Carte'
import type { EtatArrivee } from './donnees'

/** L'appli est-elle ouverte depuis l'écran d'accueil (seul cas où l'iPhone accepte les notifications) ? */
const depuisEcranAccueil = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
const iphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent)

const finir = (notifs: EtatArrivee['notifs']) =>
  db.reglages.get('arrivee').then((a) => enregistrer(db.reglages, { id: 'arrivee', valeur: { ...(a?.valeur as EtatArrivee), notifs } }))

/**
 * Dernière étape des comptes créés avec un code (12/11/2026) : activer les notifications (rappel du matin, pesée,
 * séance remontée…). Sur iPhone, elles ne marchent que dans l'appli ouverte depuis l'écran d'accueil : sinon, on
 * explique d'abord comment l'y ajouter. Sans cette étape, beaucoup ne les activaient jamais.
 */
export function EtapeNotifications() {
  const [occupe, setOccupe] = useState(false)
  const [message, setMessage] = useState<string>()
  // Déjà abonné sur cet appareil : rien à demander
  useEffect(() => {
    abonnementActuel().then((a) => { if (a) finir('activees') }).catch(() => {})
  }, [])
  const aInstaller = iphone() && !depuisEcranAccueil()

  return (
    <div className="pt-sur mx-auto flex min-h-[100dvh] max-w-lg flex-col gap-4 px-4 pb-8">
      <div className="mt-4 flex gap-1.5"><div className="h-1 flex-1 rounded bg-accent" /></div>
      <h1 className="text-2xl font-bold">Active les notifications</h1>
      <p className="-mt-2 text-sm text-texte-2">Le matin, un rappel pour tes notes et ta séance du jour ; une alerte quand ta sortie est remontée. Sans elles, tu risques de passer à côté.</p>
      {aInstaller ? (
        <Carte titre="D’abord : mets Cycle sur ton écran d’accueil">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-texte-2">
            <li>En bas de Safari, touche <b className="text-texte">Partager</b> (le carré avec une flèche vers le haut).</li>
            <li>Choisis <b className="text-texte">Sur l’écran d’accueil</b>, puis <b className="text-texte">Ajouter</b>.</li>
            <li>Ouvre Cycle depuis sa nouvelle icône : cette page t’attend pour activer les notifications.</li>
          </ol>
          <p className="mt-2 text-xs text-texte-3">Sur iPhone, les notifications ne marchent que depuis l’icône de l’écran d’accueil.</p>
        </Carte>
      ) : (
        <Carte titre="Un toucher suffit">
          <p className="text-sm text-texte-2">Touche le bouton, puis <b className="text-texte">Autoriser</b> quand ton téléphone te le demande.</p>
          <Bouton className="mt-3" disabled={occupe || !notificationsPossibles()} onClick={async () => {
            setOccupe(true)
            setMessage(undefined)
            try {
              await activerRappels()
              await finir('activees')
            } catch (e) {
              setMessage((e as Error).message)
            } finally {
              setOccupe(false)
            }
          }}>{occupe ? 'Un instant…' : 'Activer les notifications'}</Bouton>
          {message && (
            <p className="mt-2 text-sm text-attention">{message} Si tu as touché « Refuser » : Réglages de l’iPhone → Notifications → Cycle → Autoriser, puis reviens ici.</p>
          )}
        </Carte>
      )}
      <button type="button" className="py-2 text-sm text-texte-3" onClick={() => finir('plus-tard')}>Plus tard (tu pourras les activer dans les Réglages)</button>
    </div>
  )
}
