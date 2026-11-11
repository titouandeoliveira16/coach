import { NavLink, useLocation } from 'react-router-dom'
import { CircleUserRound } from 'lucide-react'
import { IconeAccueil, IconeReglages } from '../core/ui/icones'
import { useReglage } from '../core/reglages'
import type { ReglageCompte } from '../core/inscription'
import type { ModuleApp } from './modules'

/**
 * Barre de navigation en bas de l'écran (accessible au pouce), propre au module ouvert :
 * Accueil (changer de module), le module et ses réglages (le mode d'emploi est en haut des réglages).
 */
export function BarreNavigation({ module: m }: { module: ModuleApp }) {
  const { pathname } = useLocation()
  const [compte] = useReglage<ReglageCompte>('compte', {})
  const aide = `${m.chemin}/aide`
  const reglages = `${m.chemin}/reglages`
  const entrees = [
    // Compte invité : pas d'accueil (un seul module) ; ce bouton mène au compte et aux notifications
    compte.invite
      ? { id: 'compte', nom: 'Compte', chemin: '/reglages', Icone: CircleUserRound, actif: false }
      : { id: 'accueil', nom: 'Accueil', chemin: '/', Icone: IconeAccueil, actif: false },
    { id: m.id, nom: m.nom, chemin: m.chemin, Icone: m.Icone, actif: pathname !== aide && pathname !== reglages },
    ...(m.SectionReglages ? [{ id: 'reglages', nom: 'Réglages', chemin: reglages, Icone: IconeReglages, actif: pathname === reglages || pathname === aide }] : []),
  ]

  return (
    <nav data-barre-bas className="pb-barre fixed inset-x-0 bottom-0 z-20 border-t border-bordure bg-fond">
      <ul className="mx-auto flex max-w-lg">
        {entrees.map(({ id, nom, chemin, Icone, actif }) => (
          <li key={id} className="flex-1">
            <NavLink
              to={chemin}
              className="presse flex flex-col items-center gap-1 pt-2.5 pb-1 text-[11px] font-medium"
              style={{ color: actif ? m.couleur : 'var(--color-texte-3)' }}
            >
              <Icone className="h-6 w-6" />
              {nom}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
