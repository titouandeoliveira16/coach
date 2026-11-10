import { useState } from 'react'
import { createPortal } from 'react-dom'

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
      {ouvert && createPortal(
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setOuvert(false)}>
          <div className="pb-sur w-full rounded-t-3xl border-t border-bordure bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            {titre && <p className="mb-2 text-lg font-bold">{titre}</p>}
            <p className="text-texte-2">{texte}</p>
            <button type="button" onClick={() => setOuvert(false)} className="mt-4 w-full rounded-xl bg-surface-2 py-3 font-semibold">
              Compris
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
