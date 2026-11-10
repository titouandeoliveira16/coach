import type { CSSProperties, ReactNode, Ref } from 'react'

/** Bloc de contenu de base : fond légèrement plus clair, coins arrondis. */
export function Carte({ titre, children, className = '', style, ref }: {
  titre?: string; children: ReactNode; className?: string; style?: CSSProperties; ref?: Ref<HTMLElement>
}) {
  return (
    <section ref={ref} style={style} className={`entree rounded-[14px] bg-surface p-4 ${className}`}>
      {titre && (
        <h2 className="etiquette mb-2">{titre}</h2>
      )}
      {children}
    </section>
  )
}
