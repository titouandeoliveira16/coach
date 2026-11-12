import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Feuille qui monte du bas de l'écran (formulaires courts, choix d'action). Posée sur la page elle-même
 *  (portail) : ouverte depuis une zone fixe (Aujourd'hui), elle passerait sinon sous la barre du bas. */
export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  // Tant que la feuille est ouverte, la page derrière ne défile plus
  useEffect(() => {
    const avant = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.dataset.feuille = ''
    return () => {
      document.documentElement.style.overflow = avant
      delete document.documentElement.dataset.feuille
    }
  }, [])
  return createPortal(
    <div className="fixed inset-0 z-40 flex touch-none items-end bg-black/60" onClick={onFermer}>
      <div className="feuille pb-sur max-h-[90dvh] w-full touch-pan-y overflow-y-auto overscroll-contain rounded-t-3xl border-t border-bordure bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">{titre}</p>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="px-2 text-2xl text-texte-3">×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
