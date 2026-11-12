import type { CSSProperties, ReactNode, Ref } from 'react'

/**
 * Bloc de contenu de base : fond légèrement plus clair, coins arrondis, bordure invisible qui devient orange (couleur du
 * module) quand l'encart est ouvert (classe « border-accent! » passée par l'écran). Même contour partout (12/11/2026).
 */
export function Carte({ titre, children, className = '', style, ref, visite }: {
  titre?: string; children: ReactNode; className?: string; style?: CSSProperties; ref?: Ref<HTMLElement>
  /** Repère de la visite guidée (data-visite) */
  visite?: string
}) {
  return (
    <section ref={ref} style={style} data-visite={visite} className={`entree rounded-[14px] border-[1.5px] border-transparent bg-surface p-4 ${className}`}>
      {titre && (
        <h2 className="etiquette mb-2">{titre}</h2>
      )}
      {children}
    </section>
  )
}
