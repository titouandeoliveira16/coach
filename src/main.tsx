import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.tsx'
import { demanderStockagePersistant } from './core/db'
import { calculEnCours } from './core/calcul'
import { registerSW } from 'virtual:pwa-register'
import { apresPremiereSynchro, demarrerSynchro } from './core/synchro'
import { synchroniserRappels } from './core/notifications'
import { signalerErreur, surveillerErreurs } from './core/erreurs'

surveillerErreurs()
demanderStockagePersistant()
demarrerSynchro()
// Laisse le temps à la session du compte de se restaurer
setTimeout(() => synchroniserRappels(), 5000)

// Nouvelle version publiée pendant que l'appli était ouverte (16/11/2026) : un morceau chargé à la demande n'existe plus
// sur le serveur. On recharge une fois (Vite prévient avec « vite:preloadError ») ; le drapeau est retiré après 10 s.
window.addEventListener('vite:preloadError', (ev) => {
  try {
    if (sessionStorage.getItem('coach-recharge-version') === '1') return
    sessionStorage.setItem('coach-recharge-version', '1')
  } catch { return }
  ev.preventDefault()
  location.reload()
})
setTimeout(() => { try { sessionStorage.removeItem('coach-recharge-version') } catch { /* stockage indisponible */ } }, 10_000)

// Tâches de démarrage (audit du 14/11/2026) : seulement après la première synchro réussie, pour ne jamais recalculer
// sur une vieille copie de l'appareil (elle écraserait ensuite la version du serveur). Chacune a son propre filet :
// une erreur n'empêche plus les suivantes.
apresPremiereSynchro().then(async () => {
  const etapes: [string, () => Promise<unknown>][] = [
    // Calcul de semaine coupé en plein milieu : semaine d'avant remise, puis recalculée (16/11/2026)
    ['calcul interrompu', () => import('./modules/entrainement/plan/programme').then((m) => m.reprendreCalculInterrompu())],
    // Séances à venir remises au format avec répétitions (v0.62)
    ['format des séances', () => import('./modules/entrainement/plan/programme').then((m) => m.mettreAJourFormatSeances())],
    // Saison recalculée une fois par changement de règles (v10.5 → v13.9)
    ['saison V2', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV2())],
    ['saison V3', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV3())],
    ['saison V4', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV4())],
    ['saison V5', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV5())],
    ['saison V6', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV6())],
    ['saison V7', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerSaisonV7())],
    ['muscu', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.migrerMuscu())],
    ['historique', () => import('./modules/entrainement/arrivee/donnees').then((m) => m.completerHistorique())],
    ['semaine en cours', () => import('./modules/entrainement/plan/programme').then((m) => m.actualiserSemaineEnCours())],
    // Contrôle des séances récentes recalculé avec les règles du moment (ex. arrêts exclus des moyennes, v0.71)
    ['contrôle des séances', () => import('./modules/entrainement/import/intervals').then((m) => m.recontrolerRecentes())],
  ]
  for (const [nom, etape] of etapes) await etape().catch((e) => signalerErreur(e, `Démarrage (${nom})`))
})
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
      // Jamais en plein calcul de semaine : la mise à jour attend le prochain passage en arrière-plan
      else if (miseAJourPrete && !calculEnCours()) appliquer(true)
    })
    setInterval(verifier, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
