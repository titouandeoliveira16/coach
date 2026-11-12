import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { demanderStockagePersistant } from './core/db'
import { registerSW } from 'virtual:pwa-register'
import { demarrerSynchro } from './core/synchro'
import { synchroniserRappels } from './core/notifications'
import { signalerErreur, surveillerErreurs } from './core/erreurs'

surveillerErreurs()
demanderStockagePersistant()
demarrerSynchro()
// Laisse le temps à la session du compte de se restaurer
setTimeout(() => synchroniserRappels(), 5000)

// Après la première synchro : séances à venir remises au format avec répétitions (v0.62)
setTimeout(() => import('./modules/entrainement/plan/programme').then((m) => m.mettreAJourFormatSeances()).catch((e) => signalerErreur(e, 'Démarrage (format des séances)')), 8000)
// Contrôle des séances récentes recalculé avec les règles du moment (ex. arrêts exclus des moyennes, v0.71)
setTimeout(() => import('./modules/entrainement/import/intervals').then((m) => m.recontrolerRecentes()).catch((e) => signalerErreur(e, 'Démarrage (contrôle des séances)')), 12000)
// Saison recalculée une fois avec la prépa hivernale Methodic (v10.5)
setTimeout(() => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV2().then(m.migrerSaisonV3).then(m.migrerSaisonV4).then(m.completerHistorique)).catch((e) => signalerErreur(e, 'Démarrage (saison)')), 9000)
// Au retour dans l'appli : l'historique de 6 mois est relu (au plus une fois par heure) tant qu'il est incomplet
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') import('./modules/entrainement/arrivee/donnees').then((m) => m.completerHistorique()).catch(() => {})
})

// Mises à jour : on vérifie s'il existe une nouvelle version à chaque retour sur l'appli (iPhone : l'appli est souvent
// « réveillée » plutôt que relancée) et toutes les heures. Une nouvelle version ne recharge plus la page en pleine
// saisie (audit du 11/11/2026) : elle s'installe quand tu quittes l'appli, et tu la retrouves au retour.
let miseAJourPrete = false
const appliquer = registerSW({
  immediate: true,
  onNeedRefresh() {
    miseAJourPrete = true
  },
  onRegisteredSW(_url, enregistrement) {
    if (!enregistrement) return
    const verifier = () => enregistrement.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier()
      else if (miseAJourPrete) appliquer(true)
    })
    setInterval(verifier, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
