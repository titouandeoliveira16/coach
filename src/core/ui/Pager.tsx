import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

export interface Page {
  /** Chemin complet de l'onglet */
  vers: string
  element: ReactNode
}

/** Le geste part-il d'un endroit qui a son propre glissement (graphique, liste qui défile de côté, champ, feuille) ? */
function gesteInterne(cible: EventTarget | null) {
  for (let e = cible as HTMLElement | null; e && e !== document.body; e = e.parentElement) {
    if (e.tagName === 'svg' || e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || e.dataset.pasGlisser !== undefined) return true
    if (e.classList.contains('feuille') || e.dataset.pager !== undefined) break
    const ox = getComputedStyle(e).overflowX
    if ((ox === 'auto' || ox === 'scroll') && e.scrollWidth > e.clientWidth + 2) return true
  }
  return !!document.querySelector('.feuille')
}

/** Place libre entre l'en-tête (en haut) et la barre du bas : le pager l'occupe en entier. */
function useZone() {
  const [zone, setZone] = useState<{ haut: number; bas: number }>()
  useLayoutEffect(() => {
    const mesurer = () => {
      const entete = document.querySelector('header[data-entete]')
      const barre = document.querySelector('nav[data-barre-bas]')
      const haut = entete?.getBoundingClientRect().bottom ?? 0
      const bas = barre ? window.innerHeight - barre.getBoundingClientRect().top : 0
      setZone((z) => (z && z.haut === haut && z.bas === bas ? z : { haut, bas }))
    }
    mesurer()
    const t = setTimeout(mesurer, 300)
    window.addEventListener('resize', mesurer)
    window.visualViewport?.addEventListener('resize', mesurer)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', mesurer)
      window.visualViewport?.removeEventListener('resize', mesurer)
    }
  }, [])
  return zone
}

const TRANSITION = 'transform 0.36s cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * Onglets d'un module posés côte à côte sur une bande (11/11/2026) : la bande suit le doigt (on voit déjà la page
 * voisine), puis se cale sur la page choisie, comme sur les applis natives. Toucher un onglet fait glisser la bande.
 * Chaque page défile seule (sa position est gardée) ; les pages voisines sont déjà prêtes, sans écran noir.
 */
export function Pager({ pages }: { pages: Page[] }) {
  const { pathname } = useLocation()
  const naviguer = useNavigate()
  const zone = useZone()
  const piste = useRef<HTMLDivElement>(null)
  const actif = pages.findIndex((p) => pathname === p.vers || pathname.startsWith(`${p.vers}/`))
  // Pages montées : la page actuelle, ses voisines et celles déjà vues (leur défilement est gardé)
  const [montees, setMontees] = useState<Set<number>>(() => new Set([actif - 1, actif, actif + 1]))
  useEffect(() => {
    if (actif < 0) return
    setMontees((m) => (m.has(actif - 1) && m.has(actif) && m.has(actif + 1) ? m : new Set([...m, actif - 1, actif, actif + 1])))
  }, [actif])

  const n = pages.length
  const position = (i: number, dx = 0) => `translate3d(calc(${(-i * 100) / n}% + ${dx}px), 0, 0)`

  // Changement d'onglet (toucher un onglet, ou fin du geste) : la bande glisse jusqu'à la page
  const premiere = useRef(true)
  useLayoutEffect(() => {
    const el = piste.current
    if (!el || actif < 0) return
    el.style.transition = premiere.current ? 'none' : TRANSITION
    el.style.transform = position(actif)
    premiere.current = false
  }, [actif, zone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Glissement au doigt
  useEffect(() => {
    const el = piste.current
    if (!el || actif < 0) return
    let depart: { x: number; y: number; t: number } | undefined
    let horizontal: boolean | undefined
    let dx = 0
    const debut = (e: TouchEvent) => {
      horizontal = undefined
      dx = 0
      depart = e.touches.length === 1 && !gesteInterne(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : undefined
    }
    const mouvement = (e: TouchEvent) => {
      if (!depart) return
      const x = e.touches[0].clientX - depart.x
      const y = e.touches[0].clientY - depart.y
      if (horizontal === undefined && Math.hypot(x, y) > 8) horizontal = Math.abs(x) > Math.abs(y) * 1.15
      if (!horizontal) return
      // En bout de bande (premier ou dernier onglet), elle résiste
      const bout = (x > 0 && actif === 0) || (x < 0 && actif === n - 1)
      dx = bout ? x / 3.5 : x
      el.style.transition = 'none'
      el.style.transform = position(actif, dx)
    }
    const fin = () => {
      if (!depart) return
      const vitesse = Math.abs(dx) / Math.max(1, Date.now() - depart.t)
      depart = undefined
      if (!horizontal) return
      const largeur = el.parentElement?.clientWidth ?? window.innerWidth
      const cible = actif + (dx < 0 ? 1 : -1)
      const changer = (Math.abs(dx) > largeur * 0.25 || (vitesse > 0.35 && Math.abs(dx) > 30)) && cible >= 0 && cible < n
      if (changer) naviguer(pages[cible].vers)
      else {
        el.style.transition = TRANSITION
        el.style.transform = position(actif)
      }
    }
    el.addEventListener('touchstart', debut, { passive: true })
    el.addEventListener('touchmove', mouvement, { passive: true })
    el.addEventListener('touchend', fin, { passive: true })
    el.addEventListener('touchcancel', fin, { passive: true })
    return () => {
      el.removeEventListener('touchstart', debut)
      el.removeEventListener('touchmove', mouvement)
      el.removeEventListener('touchend', fin)
      el.removeEventListener('touchcancel', fin)
    }
  }, [actif, n, pages, naviguer]) // eslint-disable-line react-hooks/exhaustive-deps

  if (actif < 0) return <Navigate to={pages[0].vers} replace />
  return (
    <div data-pager className="fixed inset-x-0 mx-auto max-w-lg overflow-hidden" style={zone ? { top: zone.haut, bottom: zone.bas } : { top: 0, bottom: 0, visibility: 'hidden' }}>
      <div ref={piste} className="flex h-full will-change-transform" style={{ width: `${n * 100}%`, transform: position(actif) }}>
        {pages.map((p, i) => (
          <section key={p.vers} aria-hidden={i !== actif} className="h-full touch-pan-y overflow-y-auto overscroll-contain px-4 pb-28" style={{ width: `${100 / n}%` }}
            {...(i !== actif ? { inert: true } : {})}>
            {montees.has(i) ? p.element : null}
          </section>
        ))}
      </div>
    </div>
  )
}
