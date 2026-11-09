import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Cartes ponctuelles (bilan du dimanche, test à valider, plan Campus…) rangées dans un seul bandeau, pour que
 * l'écran Aujourd'hui tienne sur un écran : le bandeau compte les cartes affichées et les ouvre dans une feuille.
 * Les cartes restent montées (cachées) : leur état n'est pas perdu à l'ouverture.
 */
export function BandeauAVoir({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [titres, setTitres] = useState<string[]>([])
  const [ouvert, setOuvert] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const lire = () => {
      const t = [...el.children].map((c) => {
        const titre = c.querySelector('h2')?.textContent ?? (c as HTMLElement).innerText?.split('\n')[0] ?? ''
        return titre.replace(/^[^\p{L}\d]+/u, '').trim()
      }).filter(Boolean)
      setTitres((avant) => (avant.join('|') === t.join('|') ? avant : t))
    }
    lire()
    const obs = new MutationObserver(lire)
    obs.observe(el, { childList: true, subtree: true, characterData: true })
    return () => obs.disconnect()
  }, [])

  return (
    <>
      {titres.length > 0 && (
        <button type="button" onClick={() => setOuvert(true)}
          className="flex w-full shrink-0 items-center gap-2.5 rounded-xl border border-accent/45 bg-accent/10 px-3 py-2.5 text-left">
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-[13px] font-bold text-fond">{titres.length}</span>
          <span className="min-w-0 flex-1 truncate text-sm">{titres.join(' · ')}</span>
          <span className="text-accent">›</span>
        </button>
      )}
      {/* Plus rien à voir : la feuille se referme d'elle-même. Posée sur la page (portail) : dans la zone fixe
          d'Aujourd'hui, elle passait sous la barre du bas et cachait les boutons en bas des cartes */}
      {createPortal(<div className={ouvert && titres.length ? 'fixed inset-0 z-40 flex items-end bg-black/60' : 'hidden'} onClick={() => setOuvert(false)}>
        <div className="pb-sur max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl border-t border-bordure bg-fond p-4" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-lg font-bold">À voir aujourd'hui</p>
            <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer" className="px-2 text-2xl text-texte-3">×</button>
          </div>
          <div ref={ref} className="space-y-3">{children}</div>
        </div>
      </div>, document.body)}
    </>
  )
}
