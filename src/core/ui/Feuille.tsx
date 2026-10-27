import type { ReactNode } from 'react'

/** Feuille qui monte du bas de l'écran (formulaires courts, choix d'action). */
export function Feuille({ titre, onFermer, children }: { titre: string; onFermer: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onFermer}>
      <div className="pb-sur max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border-t border-bordure bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-lg font-bold">{titre}</p>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="px-2 text-2xl text-texte-3">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
