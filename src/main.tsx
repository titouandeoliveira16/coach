import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { demanderStockagePersistant } from './core/db'
import { registerSW } from 'virtual:pwa-register'
import { demarrerSynchro } from './core/synchro'

demanderStockagePersistant()
demarrerSynchro()

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
