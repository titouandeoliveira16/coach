import type { CSSProperties, ReactNode, Ref } from 'react'

/** Bloc de contenu de base : fond légèrement plus clair, coins arrondis. */
export function Carte({ titre, children, className = '', style, ref }: {
  titre?: string; children: ReactNode; className?: string; style?: CSSProperties; ref?: Ref<HTMLElement>
}) {
  return (
    <section ref={ref} style={style} className={`rounded-2xl border border-bordure bg-surface p-4 ${className}`}>
      {titre && (
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-texte-3">{titre}</h2>
      )}
      {children}
    </section>
  )
}
