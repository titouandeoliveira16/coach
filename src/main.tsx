import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { demanderStockagePersistant } from './core/db'
import { registerSW } from 'virtual:pwa-register'
import { demarrerSynchro } from './core/synchro'
import { synchroniserRappels } from './core/notifications'

demanderStockagePersistant()
demarrerSynchro()
// Laisse le temps à la session du compte de se restaurer
setTimeout(() => synchroniserRappels(), 5000)

// Après la première synchro : séances à venir remises au format avec répétitions (v0.62)
setTimeout(() => import('./modules/entrainement/plan/programme').then((m) => m.mettreAJourFormatSeances()).catch(() => {}), 8000)
// Contrôle des séances récentes recalculé avec les règles du moment (ex. arrêts exclus des moyennes, v0.71)
setTimeout(() => import('./modules/entrainement/import/intervals').then((m) => m.recontrolerRecentes()).catch(() => {}), 12000)
// Saison recalculée une fois avec la prépa hivernale Methodic (v10.5)
setTimeout(() => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV2()).catch(() => {}), 9000)

// Mises à jour : on vérifie s'il existe une nouvelle version à chaque retour
// sur l'appli (iPhone : l'appli est souvent « réveillée » plutôt que relancée)
// et toutes les heures. Si oui, elle s'installe et la page se recharge seule.
registerSW({
  immediate: true,
  onRegisteredSW(_url, enregistrement) {
    if (!enregistrement) return
    const verifier = () => enregistrement.update().catch(() => {})
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier()
    })
    setInterval(verifier, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
