import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useBloquerFond } from './bloquerFond'

/**
 * Petit « ? » à côté d'un chiffre : un toucher ouvre en bas de l'écran
 * une phrase qui explique comment il est calculé.
 */
export function Aide({ texte, titre }: { texte: string; titre?: string }) {
  const [ouvert, setOuvert] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`Comment est calculé : ${titre ?? 'ce chiffre'}`}
        onClick={(e) => {
          e.stopPropagation()
          setOuvert(true)
        }}
        className="relative ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-texte-3/40 text-[11px] font-bold text-texte-2 align-middle before:absolute before:-inset-3 before:content-['']"
      >
        ?
      </button>
      {ouvert && <FenetreAide titre={titre} texte={texte} onFermer={() => setOuvert(false)} />}
    </>
  )
}

/** La fenêtre de l'aide : ne dépasse jamais l'écran (le texte défile), « Compris » toujours visible en bas. */
function FenetreAide({ titre, texte, onFermer }: { titre?: string; texte: string; onFermer: () => void }) {
  useBloquerFond()
  return createPortal(
    <div className="fixed inset-0 z-50 flex touch-none items-end bg-black/60" onClick={onFermer}>
      <div className="pb-sur flex max-h-[85dvh] w-full flex-col rounded-t-3xl border-t border-bordure bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 pt-5">
          {titre && <p className="mb-2 text-lg font-bold">{titre}</p>}
          <p className="text-texte-2">{texte}</p>
        </div>
        <div className="shrink-0 px-5 pt-3 pb-1">
          <button type="button" onClick={onFermer} className="w-full rounded-xl bg-surface-2 py-3 font-semibold">Compris</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
