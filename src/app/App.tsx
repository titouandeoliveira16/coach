import type { CSSProperties } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { BarreNavigation } from './BarreNavigation'
import { MODULES } from './modules'
import { Reglages } from './Reglages'

/**
 * Coquille commune : applique la couleur d'accent du module affiché,
 * affiche l'écran demandé et la barre de navigation du bas.
 */
function Coquille() {
  const { pathname } = useLocation()
  const moduleActif = MODULES.find((m) => pathname.startsWith(m.chemin))
  const style = { '--accent': moduleActif?.couleur ?? '#f2f4f7' } as CSSProperties

  return (
    <div style={style} className="mx-auto min-h-full max-w-lg pb-28">
      <Routes>
        {MODULES.map((m) => (
          <Route key={m.id} path={`${m.chemin}/*`} element={<m.Ecran />} />
        ))}
        <Route path="/reglages" element={<Reglages />} />
        {/* Par défaut : premier module */}
        <Route path="*" element={<Navigate to={MODULES[0].chemin} replace />} />
      </Routes>
      <BarreNavigation />
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
