import type { CSSProperties } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BarreNavigation } from './BarreNavigation'
import { Accueil } from './Accueil'
import { MODULES } from './modules'
import { Reglages } from './Reglages'
import { ReglagesGeneraux } from './ReglagesGeneraux'

/**
 * Coquille commune : applique la couleur d'accent du module affiché,
 * affiche l'écran demandé et la barre de navigation du bas.
 */
function Coquille() {
  const { pathname } = useLocation()
  const moduleActif = MODULES.find((m) => pathname.startsWith(m.chemin))
  // --color-accent est aussi redéfini ici : sinon il garde la valeur calculée à la racine (orange)
  const accent = moduleActif?.couleur ?? '#f2f4f7'
  const style = { '--accent': accent, '--color-accent': accent } as CSSProperties

  return (
    <div style={style} className={`mx-auto min-h-full max-w-lg ${moduleActif ? 'pb-28' : 'pb-8'}`}>
      <Routes>
        {MODULES.map((m) => (
          <Route key={m.id} path={`${m.chemin}/*`} element={<m.Ecran />} />
        ))}
        {/* Mode d'emploi et réglages : propres à chaque module */}
        {MODULES.filter((m) => m.ModeEmploi).map((m) => <Route key={`${m.id}-aide`} path={`${m.chemin}/aide`} element={m.ModeEmploi && <m.ModeEmploi />} />)}
        {MODULES.filter((m) => m.SectionReglages).map((m) => <Route key={`${m.id}-reglages`} path={`${m.chemin}/reglages`} element={<Reglages module={m} />} />)}
        <Route path="/" element={<Accueil />} />
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
