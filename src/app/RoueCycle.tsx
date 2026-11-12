import { useEffect, useLayoutEffect, useRef } from 'react'

/**
 * Ouverture de Cycle (maquette validée le 12/11/2026) : le C de l'icône arrive de la gauche en roue complète, avec ses
 * rayons, roule sans glisser, s'arrête à sa place ; la partie manquante puis les rayons s'effacent et il reste le C.
 * `onFini` est appelé quand le C est posé (l'auréole et le formulaire apparaissent alors).
 */
const R = 27, EP = 14, N = 160
const ZONES = [[124, 123, 116], [59, 158, 255], [70, 167, 88], [255, 197, 61], [247, 107, 21], [229, 72, 77]]
const couleur = (t: number) => {
  const x = Math.max(0, Math.min(1, t)) * 5, i = Math.min(4, Math.floor(x)), f = x - i
  return `rgb(${ZONES[i].map((v, k) => Math.round(v + (ZONES[i + 1][k] - v) * f)).join(',')})`
}
const pt = (a: number) => [R * Math.cos((a * Math.PI) / 180), R * Math.sin((a * Math.PI) / 180)]
// Du haut à droite (318°) au bas à droite (42°) en passant par la gauche, du gris (Z1) au rouge (Z6)
const SEGMENTS = Array.from({ length: N }, (_, i) => {
  const [x1, y1] = pt(318 - (276 * i) / N), [x2, y2] = pt(318 - (276 * (i + 1)) / N)
  return { x1, y1, x2, y2, c: couleur(i / N) }
})
const [GX0, GY0] = pt(-42), [GX1, GY1] = pt(42)
const RAYONS = Array.from({ length: 12 }, (_, k) => (k * 30 * Math.PI) / 180)
const DECALAGE = 3.5 // le C fini est centré sur sa boîte (ouverture à droite)
const TOURS = 1.6
const DISTANCE = TOURS * 2 * Math.PI * (R + EP / 2) // roulement sans glisser
const DUREE = 1500

export function RoueCycle({ taille, onFini }: { taille: number; onFini?: () => void }) {
  const mobile = useRef<SVGGElement>(null)
  const tourne = useRef<SVGGElement>(null)
  const roue = useRef<SVGGElement>(null) // partie manquante, rayons, moyeu
  const fini = useRef(onFini)
  useLayoutEffect(() => { fini.current = onFini })

  useEffect(() => {
    const poser = (e: number) => {
      const reste = 1 - e
      mobile.current?.setAttribute('transform', `translate(${DECALAGE - DISTANCE * reste} 0)`)
      tourne.current?.setAttribute('transform', `rotate(${((-DISTANCE * reste) / (R + EP / 2)) * (180 / Math.PI)})`)
    }
    const minuteurs: ReturnType<typeof setTimeout>[] = []
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      poser(1)
      if (roue.current) roue.current.style.opacity = '0'
      fini.current?.()
      return
    }
    let id = 0
    const debut = performance.now()
    const image = (t: number) => {
      const p = Math.min(1, (t - debut) / DUREE)
      poser(1 - Math.pow(1 - p, 3))
      if (p < 1) id = requestAnimationFrame(image)
    }
    poser(0)
    id = requestAnimationFrame(image)
    minuteurs.push(setTimeout(() => {
      const r = roue.current
      if (!r) return
      r.querySelector<SVGPathElement>('[data-manque]')!.style.opacity = '0'
      setTimeout(() => r.querySelectorAll<SVGElement>('[data-rayon]').forEach((x) => (x.style.opacity = '0')), 220)
    }, DUREE + 80))
    minuteurs.push(setTimeout(() => fini.current?.(), DUREE + 450))
    return () => { cancelAnimationFrame(id); minuteurs.forEach(clearTimeout) }
  }, [])

  return (
    <svg width={taille} height={taille} viewBox="-50 -50 100 100" className="overflow-visible" aria-label="Cycle" role="img">
      <g ref={mobile}>
        <g ref={tourne}>
          <g ref={roue}>
            <g data-rayon stroke="rgba(255,255,255,.55)" strokeWidth="1.6" strokeLinecap="round" style={{ transition: 'opacity .5s ease' }}>
              {RAYONS.map((a) => <line key={a} x1={4 * Math.cos(a)} y1={4 * Math.sin(a)} x2={(R - EP / 2 + 1) * Math.cos(a)} y2={(R - EP / 2 + 1) * Math.sin(a)} />)}
            </g>
            <circle data-rayon r="4.2" fill="rgba(255,255,255,.75)" style={{ transition: 'opacity .5s ease' }} />
            <path data-manque d={`M${GX0} ${GY0} A${R} ${R} 0 0 1 ${GX1} ${GY1}`} fill="none" stroke="rgba(255,255,255,.38)" strokeWidth={EP} strokeLinecap="round" style={{ transition: 'opacity .45s ease' }} />
          </g>
          {SEGMENTS.map((s, i) => <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.c} strokeWidth={EP} strokeLinecap="round" />)}
        </g>
      </g>
    </svg>
  )
}
