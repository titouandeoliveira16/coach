import type { ReactNode } from 'react'

/** Bloc de contenu de base : fond légèrement plus clair, coins arrondis. */
export function Carte({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-bordure bg-surface p-4">
      {titre && (
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-texte-3">{titre}</h2>
      )}
      {children}
    </section>
  )
}
