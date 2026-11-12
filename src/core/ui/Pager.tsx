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
  // (les nouvelles voisines sont construites une fois le glissement fini, pour ne pas le ralentir)
  const [montees, setMontees] = useState<Set<number>>(() => new Set([actif - 1, actif, actif + 1]))
  useEffect(() => {
    if (actif < 0) return
    setMontees((m) => (m.has(actif) ? m : new Set([...m, actif])))
    const t = setTimeout(() => setMontees((m) => (m.has(actif - 1) && m.has(actif + 1) ? m : new Set([...m, actif - 1, actif + 1]))), 450)
    return () => clearTimeout(t)
  }, [actif])
  // Chaque page n'est construite qu'une fois : changer d'onglet ne la recalcule pas (elle se met à jour seule avec ses données)
  const elements = useRef(new Map<string, ReactNode>())
  const element = (p: Page) => {
    if (!elements.current.has(p.vers)) elements.current.set(p.vers, p.element)
    return elements.current.get(p.vers)
  }

  const n = pages.length
  const position = (i: number, dx = 0) => `translate3d(calc(${(-i * 100) / n}% + ${dx}px), 0, 0)`
  // La bulle des onglets (en bas) suit la bande
  const placerBulle = (pos: number, anime: boolean) => {
    const b = document.querySelector<HTMLElement>('[data-bulle]')
    if (!b) return
    b.style.transition = anime ? TRANSITION : 'none'
    b.style.transform = `translate3d(${pos * 100}%, 0, 0)`
    // Le nom sous la bulle passe en sombre dès qu'elle est dessus
    const nav = b.parentElement
    if (nav) nav.dataset.proche = String(Math.round(pos))
  }

  // Changement d'onglet (toucher un onglet, ou fin du geste) : la bande glisse jusqu'à la page
  const premiere = useRef(true)
  useLayoutEffect(() => {
    const el = piste.current
    if (!el || actif < 0) return
    el.style.transition = premiere.current ? 'none' : TRANSITION
    el.style.transform = position(actif)
    placerBulle(actif, !premiere.current)
    premiere.current = false
  }, [actif, zone]) // eslint-disable-line react-hooks/exhaustive-deps

  // Glissement au doigt (écouteurs posés une seule fois : une mise à jour de l'écran ne coupe pas le geste)
  const etat = useRef({ actif, pages, naviguer })
  useLayoutEffect(() => {
    etat.current = { actif, pages, naviguer }
  })
  const valide = actif >= 0
  useEffect(() => {
    const el = piste.current
    if (!el || !valide) return
    let depart: { x: number; y: number; t: number; i: number } | undefined
    let horizontal: boolean | undefined
    let dx = 0
    let enCours = false
    const largeur = () => el.parentElement?.clientWidth ?? window.innerWidth
    const debut = (e: TouchEvent) => {
      depart = undefined
      if (enCours || e.touches.length !== 1 || gesteInterne(e.target)) return // (la bande finit de se caler)
      horizontal = undefined
      dx = 0
      depart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), i: etat.current.actif }
    }
    const mouvement = (e: TouchEvent) => {
      if (!depart) return
      const x = e.touches[0].clientX - depart.x
      const y = e.touches[0].clientY - depart.y
      if (horizontal === undefined && Math.hypot(x, y) > 8) horizontal = Math.abs(x) > Math.abs(y) * 1.15
      if (!horizontal) return
      const n = etat.current.pages.length
      // En bout de bande (premier ou dernier onglet), elle résiste
      const bout = (x > 0 && depart.i === 0) || (x < 0 && depart.i === n - 1)
      dx = bout ? x / 3.5 : x
      el.style.transition = 'none'
      el.style.transform = position(depart.i, dx)
      placerBulle(depart.i - dx / largeur(), false)
    }
    const fin = () => {
      if (!depart) return
      const { i, t } = depart
      depart = undefined
      if (!horizontal) return
      const vitesse = Math.abs(dx) / Math.max(1, Date.now() - t)
      const cible = i + (dx < 0 ? 1 : -1)
      const changer = (Math.abs(dx) > largeur() * 0.25 || (vitesse > 0.35 && Math.abs(dx) > 30)) && cible >= 0 && cible < etat.current.pages.length
      const arrivee = changer ? cible : i
      el.style.transition = TRANSITION
      el.style.transform = position(arrivee)
      placerBulle(arrivee, true)
      // On change d'onglet seulement une fois la bande calée : rien ne se recalcule pendant l'animation
      if (changer) {
        enCours = true
        setTimeout(() => {
          enCours = false
          etat.current.naviguer(etat.current.pages[cible].vers)
        }, 380)
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
  }, [valide]) // eslint-disable-line react-hooks/exhaustive-deps

  if (actif < 0) return <Navigate to={pages[0].vers} replace />
  return (
    // Un champ ou un focus dans une page voisine ne doit jamais décaler la bande (overflow caché mais défilable par le code)
    <div data-pager onScroll={(e) => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0 }} className="fixed inset-x-0 mx-auto max-w-lg overflow-hidden" style={zone ? { top: zone.haut, bottom: zone.bas } : { top: 0, bottom: 0, visibility: 'hidden' }}>
      <div ref={piste} className="flex h-full will-change-transform" style={{ width: `${n * 100}%`, transform: position(actif) }}>
        {pages.map((p, i) => (
          <section key={p.vers} aria-hidden={i !== actif} className="h-full touch-pan-y overflow-y-auto overscroll-contain px-4 pb-28" style={{ width: `${100 / n}%` }}
            {...(i !== actif ? { inert: true } : {})}>
            {montees.has(i) ? element(p) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
