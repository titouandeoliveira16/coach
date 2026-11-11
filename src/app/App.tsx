import { useLiveQuery } from 'dexie-react-hooks'
import type { CSSProperties } from 'react'
import { aujourdhui } from '../core/dates'
import { db } from '../core/db'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BarreNavigation } from './BarreNavigation'
import { Accueil } from './Accueil'
import { MODULES } from './modules'
import { Reglages } from './Reglages'
import { ReglagesGeneraux } from './ReglagesGeneraux'
import { Entree } from './Entree'
import { useSynchro } from '../core/synchro'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'
import { QuestionnaireArrivee } from '../modules/entrainement/arrivee/QuestionnaireArrivee'
import type { EtatArrivee } from '../modules/entrainement/arrivee/donnees'

const LUEURS = { vert: 'rgba(48,209,88,.14)', orange: 'rgba(255,159,10,.14)', rouge: 'rgba(255,69,58,.14)' }

/**
 * Coquille commune : applique la couleur d'accent du module affiché,
 * affiche l'écran demandé et la barre de navigation du bas.
 */
function Coquille() {
  const { pathname } = useLocation()
  const { session, pret, derniereSynchro } = useSynchro()
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const [arrivee] = useReglage<EtatArrivee>('arrivee', {})
  const moduleActif = MODULES.find((m) => pathname.startsWith(m.chemin))
  // --color-accent est aussi redéfini ici : sinon il garde la valeur calculée à la racine (orange)
  const accent = moduleActif?.couleur ?? '#f2f4f7'
  // Lueur en haut de l'écran (10/11/2026) : la couleur du feu du jour dans l'Entraînement, bleu léger dans la Révision
  const feu = useLiveQuery(async () => (await db.decisions.get(aujourdhui()))?.couleur, [])
  const lueur = moduleActif?.id === 'entrainement' && feu ? LUEURS[feu] : moduleActif?.id === 'revision' ? 'rgba(96,165,250,.16)' : 'transparent'
  const style = { '--accent': accent, '--color-accent': accent, '--lueur': lueur } as CSSProperties

  // Personne de connecté sur cet appareil : connexion, ou création du compte avec un code
  if (!pret) return null
  if (!session) return <Entree />
  // Questionnaire d'arrivée (après la 1re synchro, pour ne pas le reposer sur un 2e appareil) : tout compte qui ne l'a
  // pas fait, y compris celui de Titouan (sa saison est calculée depuis 11/2026), puis la montre pour les comptes créés
  // avec un code
  if (derniereSynchro && !arrivee.fait) return <QuestionnaireArrivee />
  if (compte.invite && arrivee.fait && !arrivee.montre) return <QuestionnaireArrivee montreSeulement />

  // Dans un module, la page est toujours un peu plus haute que l'écran : sur iPhone (appli installée),
  // la barre du bas ne reste collée en bas que si la page peut défiler
  return (
    <div style={style} className={`mx-auto max-w-lg ${moduleActif ? 'min-h-[calc(100vh+1px)] pb-44' : 'min-h-full pb-8'}`}>
      {moduleActif && <div aria-hidden className="lueur pointer-events-none fixed inset-x-0 top-0 -z-10 h-[380px]" />}
      <Routes>
        {MODULES.map((m) => (
          <Route key={m.id} path={`${m.chemin}/*`} element={compte.invite && m.id !== 'entrainement' && m.id !== 'catalogue' ? <Navigate to="/entrainement" replace /> : <m.Ecran />} />
        ))}
        {/* Mode d'emploi et réglages : propres à chaque module */}
        {MODULES.filter((m) => m.ModeEmploi).map((m) => <Route key={`${m.id}-aide`} path={`${m.chemin}/aide`} element={m.ModeEmploi && <m.ModeEmploi />} />)}
        {MODULES.filter((m) => m.SectionReglages).map((m) => <Route key={`${m.id}-reglages`} path={`${m.chemin}/reglages`} element={<Reglages module={m} />} />)}
        {/* Compte invité (élève, frère) : l'Entraînement seul, sans passer par un accueil à une seule carte */}
        <Route path="/" element={compte.invite ? <Navigate to="/entrainement" replace /> : <Accueil />} />
        {/* Anciennes adresses (notifications, liens) */}
        <Route path="/reglages" element={<ReglagesGeneraux />} />
        <Route path="/aide" element={<Navigate to="/entrainement/aide" replace />} />
        <Route path="/argent/*" element={<Navigate to="/budget" replace />} />
        {/* Par défaut : l'accueil */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* Pas de barre sur l'accueil : il sert seulement à choisir un module */}
      {moduleActif && <BarreNavigation module={moduleActif} />}
    </div>
  )
}

export default function App() {
  // HashRouter (adresses du type /#/entrainement) : indispensable sur GitHub Pages
  // pour qu'un rechargement de page ne tombe pas sur une erreur 404.
  return (
    <HashRouter>
      <Coquille />
    </HashRouter>
  )
}
