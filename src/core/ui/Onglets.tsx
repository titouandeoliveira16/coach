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
  // Arrivée de la nouvelle page : elle glisse depuis le côté d'où l'on vient (animation CSS « glisse-* », index.css)
  const arriver = (vers: number) => {
    const racine = document.documentElement
    racine.dataset.glisse = vers < actif ? 'gauche' : 'droite'
    clearTimeout(Number(racine.dataset.glisseMinuterie))
    racine.dataset.glisseMinuterie = String(setTimeout(() => delete racine.dataset.glisse, 450))
  }
  const aller = (vers: number) => {
    arriver(vers)
    naviguer(onglets[vers].vers)
  }

  useEffect(() => {
    // Glissement qui suit le doigt : la page bouge avec lui, puis part sur le côté (ou revient si le geste est trop court)
    let depart: { x: number; y: number; t: number } | undefined
    let page: HTMLElement | null = null
    let horizontal: boolean | undefined
    const pageActuelle = () => (document.querySelector('.vt-page-fixe') as HTMLElement | null) ?? (document.querySelector('.vt-page > *') as HTMLElement | null)
    const debut = (e: TouchEvent) => {
      horizontal = undefined
      depart = e.touches.length === 1 && !gesteInterne(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : undefined
      page = depart ? pageActuelle() : null
    }
    const mouvement = (e: TouchEvent) => {
      if (!depart || !page || actif < 0) return
      const dx = e.touches[0].clientX - depart.x
      const dy = e.touches[0].clientY - depart.y
      if (horizontal === undefined && Math.hypot(dx, dy) > 10) horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
      if (!horizontal) return
      // En bout de liste (premier ou dernier onglet), la page résiste
      const bout = (dx > 0 && actif === 0) || (dx < 0 && actif === onglets.length - 1)
      page.style.transition = 'none'
      page.style.transform = `translateX(${bout ? dx / 4 : dx}px)`
      page.style.opacity = String(1 - Math.min(0.35, Math.abs(dx) / 900))
    }
    const remettre = (el: HTMLElement) => {
      el.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s'
      el.style.transform = ''
      el.style.opacity = ''
      setTimeout(() => { el.style.transition = '' }, 300)
    }
    const fin = (e: TouchEvent) => {
      const el = page
      page = null
      if (!depart || actif < 0) return
      const dx = e.changedTouches[0].clientX - depart.x
      const vite = Math.abs(dx) / Math.max(1, Date.now() - depart.t) > 0.45
      depart = undefined
      if (!horizontal || !el) return
      const suivant = actif + (dx < 0 ? 1 : -1)
      if ((Math.abs(dx) > window.innerWidth * 0.28 || (vite && Math.abs(dx) > 40)) && suivant >= 0 && suivant < onglets.length) {
        // La page finit de sortir, puis la suivante arrive du côté opposé
        el.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 1, 1), opacity 0.18s'
        el.style.transform = `translateX(${dx < 0 ? -100 : 100}%)`
        el.style.opacity = '0'
        setTimeout(() => aller(suivant), 170)
      } else remettre(el)
    }
    const annuler = () => {
      if (page) remettre(page)
      page = null
      depart = undefined
    }
    document.addEventListener('touchstart', debut, { passive: true })
    document.addEventListener('touchmove', mouvement, { passive: true })
    document.addEventListener('touchend', fin, { passive: true })
    document.addEventListener('touchcancel', annuler, { passive: true })
    return () => {
      document.removeEventListener('touchstart', debut)
      document.removeEventListener('touchmove', mouvement)
      document.removeEventListener('touchend', fin)
      document.removeEventListener('touchcancel', annuler)
    }
  }, [actif, onglets, naviguer]) // eslint-disable-line react-hooks/exhaustive-deps

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
        {onglets.map((o, i) => (
          <NavLink
            key={o.vers}
            to={o.vers}
            end
            onClick={() => arriver(i)}
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
