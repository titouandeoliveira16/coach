import { NavLink } from 'react-router-dom'

export interface Onglet {
  libelle: string
  /** Chemin complet de l'onglet */
  vers: string
}

/** Sélecteur d'onglets en haut d'un module (style « segmenté » iOS). */
export function Onglets({ onglets }: { onglets: Onglet[] }) {
  return (
    <nav className="mt-3 flex rounded-xl bg-surface-2 p-1">
      {onglets.map((o) => (
        <NavLink
          key={o.vers}
          to={o.vers}
          end
          className={({ isActive }) =>
            `flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-colors ${
              isActive ? 'bg-accent text-fond' : 'text-texte-2'
            }`
          }
        >
          {o.libelle}
        </NavLink>
      ))}
    </nav>
  )
}
