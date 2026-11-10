import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

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

/** Le geste part-il d'un endroit qui a son propre glissement (graphique, liste qui défile de côté, feuille, curseur) ? */
function gesteInterne(cible: EventTarget | null) {
  for (let e = cible as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
    if (e.tagName === 'svg' || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.dataset.pasGlisser !== undefined) return true
    if (e.classList.contains('feuille')) return true
    const ox = getComputedStyle(e).overflowX
    if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 2) return true
  }
  return !!document.querySelector('.feuille')
}

/**
 * Onglets d'un module (style « segmenté » iOS), posés en bas juste au-dessus de la barre, à portée du pouce
 * (maquette O2, 10/11/2026). On passe aussi à l'onglet d'à côté en glissant le doigt vers la gauche ou la droite.
 */
export function Onglets({ onglets }: { onglets: Onglet[] }) {
  const bas = useHauteurBarre()
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const actif = onglets.findIndex((o) => pathname === o.vers || pathname.startsWith(`${o.vers}/`))

  useEffect(() => {
    let depart: { x: number; y: number; t: number } | undefined
    const debut = (e: TouchEvent) => {
      depart = e.touches.length === 1 && !gesteInterne(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : undefined
    }
    const fin = (e: TouchEvent) => {
      if (!depart || actif < 0) return
      const dx = e.changedTouches[0].clientX - depart.x
      const dy = e.changedTouches[0].clientY - depart.y
      const rapide = Date.now() - depart.t < 700
      depart = undefined
      if (!rapide || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return
      const suivant = actif + (dx < 0 ? 1 : -1)
      if (suivant >= 0 && suivant < onglets.length) naviguer(onglets[suivant].vers)
    }
    document.addEventListener('touchstart', debut, { passive: true })
    document.addEventListener('touchend', fin, { passive: true })
    return () => {
      document.removeEventListener('touchstart', debut)
      document.removeEventListener('touchend', fin)
    }
  }, [actif, onglets, naviguer])

  // Pas de portail : les onglets gardent la couleur du module (variable --accent posée sur la page)
  return (
    <div className="pointer-events-none fixed inset-x-0 z-20 mx-auto max-w-lg bg-linear-to-b from-transparent to-fond to-40% px-4 pt-3 pb-2" style={{ bottom: bas }}>
      <nav data-onglets className="pointer-events-auto flex rounded-full bg-surface-2 p-1 shadow-lg shadow-black/60">
        {onglets.map((o) => (
          <NavLink
            key={o.vers}
            to={o.vers}
            end
            className={({ isActive }) =>
              `presse flex-1 rounded-full py-2 text-center text-sm font-semibold transition-colors ${
                isActive ? 'bg-accent text-fond' : 'text-texte-2'
              }`
            }
          >
            {o.libelle}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
