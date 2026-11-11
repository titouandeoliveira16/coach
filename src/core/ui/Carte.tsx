import type { CSSProperties, ReactNode, Ref } from 'react'

/** Bloc de contenu de base : fond légèrement plus clair, coins arrondis. */
export function Carte({ titre, children, className = '', style, ref, visite }: {
  titre?: string; children: ReactNode; className?: string; style?: CSSProperties; ref?: Ref<HTMLElement>
  /** Repère de la visite guidée (data-visite) */
  visite?: string
}) {
  return (
    <section ref={ref} style={style} data-visite={visite} className={`entree rounded-[14px] bg-surface p-4 ${className}`}>
      {titre && (
        <h2 className="etiquette mb-2">{titre}</h2>
      )}
      {children}
    </section>
  )
}
