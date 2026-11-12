import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

export interface Onglet {
  libelle: string
  /** Chemin complet de l'onglet */
  vers: string
}

/** Hauteur de la barre du bas (fixe) : les onglets se posent juste au-dessus. */
function useHauteurBarre() {
  const [bas, setBas] = useState(84)
  useEffect(() => {
    const mesurer = () => {
      const barre = [...document.querySelectorAll('nav[data-barre-bas]')][0]
      if (barre) setBas(window.innerHeight - barre.getBoundingClientRect().top)
    }
    mesurer()
    const t = setTimeout(mesurer, 300)
    window.addEventListener('resize', mesurer)
    return () => { clearTimeout(t); window.removeEventListener('resize', mesurer) }
  }, [])
  return bas
}

/**
 * Onglets d'un module (style « segmenté » iOS), posés en bas juste au-dessus de la barre, à portée du pouce
 * (maquette O2, 10/11/2026). Le glissement entre les pages est géré par le Pager (core/ui/Pager.tsx).
 */
export function Onglets({ onglets }: { onglets: Onglet[] }) {
  const bas = useHauteurBarre()
  const { pathname } = useLocation()
  const actif = onglets.findIndex((o) => pathname === o.vers || pathname.startsWith(`${o.vers}/`))

  // Pas de portail : les onglets gardent la couleur du module (variable --accent posée sur la page)
  const n = onglets.length
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 mx-auto max-w-lg bg-linear-to-b from-transparent to-fond to-40% px-4 pt-3 pb-2" style={{ bottom: bas }}>
      <nav data-onglets data-visite="onglets" className="pointer-events-auto relative flex rounded-full bg-surface-2 p-1 shadow-lg shadow-black/60">
        {/* La bulle de l'onglet actif glisse d'un onglet à l'autre */}
        {actif >= 0 && (
          <span aria-hidden className="absolute top-1 bottom-1 left-1 rounded-full bg-accent transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${actif * 100}%)` }} />
        )}
        {onglets.map((o) => (
          <NavLink
            key={o.vers}
            to={o.vers}
            end
            className={({ isActive }) =>
              `presse relative flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors duration-300 ${isActive ? 'text-fond' : 'text-texte-2'}`
            }
          >
            {o.libelle}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
