import type { ReactNode } from 'react'

/** Titre de page, collé en haut et sous l'encoche de l'iPhone. */
export function EnTete({ titre, aDroite, children }: { titre: string; aDroite?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-sur sticky top-0 z-10 bg-fond/95 px-4 pb-3 backdrop-blur">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
        {aDroite && <span className="text-sm text-texte-2">{aDroite}</span>}
      </div>
      {children}
    </header>
  )
}
