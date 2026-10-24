import { NavLink } from 'react-router-dom'
import { IconeAccueil, IconeAide, IconeReglages } from '../core/ui/icones'

/**
 * Barre de navigation en bas de l'écran (accessible au pouce).
 * Accueil (choix du module), mode d'emploi et Réglages.
 */
export function BarreNavigation() {
  const entrees = [
    { id: 'accueil', nom: 'Accueil', chemin: '/', couleur: '#f2f4f7', Icone: IconeAccueil },
    { id: 'aide', nom: "Mode d'emploi", chemin: '/aide', couleur: '#f2f4f7', Icone: IconeAide },
    { id: 'reglages', nom: 'Réglages', chemin: '/reglages', couleur: '#f2f4f7', Icone: IconeReglages },
  ]

  return (
    <nav className="pb-sur fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {entrees.map(({ id, nom, chemin, couleur, Icone }) => (
          <li key={id} className="flex-1">
            <NavLink
              to={chemin}
              end={chemin === '/'}
              className="flex flex-col items-center gap-1 pt-2 pb-1 text-[11px] font-medium"
              style={({ isActive }) => ({ color: isActive ? couleur : 'var(--color-texte-3)' })}
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
