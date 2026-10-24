import { NavLink, useLocation } from 'react-router-dom'
import { IconeAccueil, IconeAide, IconeReglages } from '../core/ui/icones'
import type { ModuleApp } from './modules'

/**
 * Barre de navigation en bas de l'écran (accessible au pouce), propre au module ouvert :
 * Accueil (changer de module), le module, son mode d'emploi et ses réglages.
 */
export function BarreNavigation({ module: m }: { module: ModuleApp }) {
  const { pathname } = useLocation()
  const aide = `${m.chemin}/aide`
  const reglages = `${m.chemin}/reglages`
  const entrees = [
    { id: 'accueil', nom: 'Accueil', chemin: '/', Icone: IconeAccueil, actif: false },
    { id: m.id, nom: m.nom, chemin: m.chemin, Icone: m.Icone, actif: pathname !== aide && pathname !== reglages },
    ...(m.ModeEmploi ? [{ id: 'aide', nom: "Mode d'emploi", chemin: aide, Icone: IconeAide, actif: pathname === aide }] : []),
    ...(m.SectionReglages ? [{ id: 'reglages', nom: 'Réglages', chemin: reglages, Icone: IconeReglages, actif: pathname === reglages }] : []),
  ]

  return (
    <nav className="pb-sur fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {entrees.map(({ id, nom, chemin, Icone, actif }) => (
          <li key={id} className="flex-1">
            <NavLink
              to={chemin}
              className="flex flex-col items-center gap-1 pt-2 pb-1 text-[11px] font-medium"
              style={{ color: actif ? m.couleur : 'var(--color-texte-3)' }}
            >
              <Icone className="h-7 w-7" />
              {nom}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
