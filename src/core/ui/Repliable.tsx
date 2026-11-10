import { useState, type ReactNode } from 'react'

/**
 * Encart qu'on ouvre et qu'on réduit : fermé, une ligne (titre + résumé) et « Modifier › » ;
 * ouvert, entouré de la couleur du module et « Réduire ▴ ». Même comportement dans toute l'appli.
 */
export function Repliable({ titre, resume, children, ouvert: ouvertParent, onBasculer, libelle = 'Modifier', className = '' }: {
  titre: string
  /** Ce qu'on voit sans ouvrir */
  resume?: ReactNode
  children: ReactNode
  /** Ouvert ou non (sinon géré par l'encart lui-même) */
  ouvert?: boolean
  onBasculer?: (ouvert: boolean) => void
  /** Texte du bouton quand c'est fermé */
  libelle?: string
  className?: string
}) {
  const [ouvertLocal, setOuvertLocal] = useState(false)
  const ouvert = ouvertParent ?? ouvertLocal
  const basculer = () => (onBasculer ? onBasculer(!ouvert) : setOuvertLocal(!ouvert))
  return (
    <section className={`entree rounded-[14px] border bg-surface ${ouvert ? 'border-accent' : 'border-transparent'} ${className}`}>
      <button type="button" onClick={basculer} aria-expanded={ouvert} className="presse flex w-full items-center gap-3 px-3.5 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="etiquette block">{titre}</span>
          {!ouvert && resume && <span className="mt-0.5 block text-sm leading-snug text-texte-2">{resume}</span>}
        </span>
        <span className="shrink-0 text-sm font-semibold text-accent">{ouvert ? 'Réduire ▴' : `${libelle} ›`}</span>
      </button>
      {ouvert && <div className="px-3.5 pb-3.5">{children}</div>}
    </section>
  )
}

/** Petit carré (grille de 3) qui ouvre un encart en dessous : entouré quand il est ouvert. */
export function Tuile({ titre, ouvert, onClick, fleche = '▾' }: { titre: string; ouvert?: boolean; onClick: () => void; fleche?: string }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={ouvert}
      className={`presse flex items-center justify-between gap-2 rounded-[14px] border bg-surface px-3.5 py-3.5 text-left ${ouvert ? 'border-accent' : 'border-transparent'}`}>
      <span className="text-sm font-semibold leading-tight">{titre}</span>
      <span className={`text-sm ${ouvert ? 'text-accent' : 'text-texte-3'}`}>{ouvert ? '▴' : fleche}</span>
    </button>
  )
}
