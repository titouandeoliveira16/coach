import type { ReactNode } from 'react'

/** Titre de page, collé en haut et sous l'encoche de l'iPhone. */
export function EnTete({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <header className="pt-sur sticky top-0 z-10 bg-fond/95 px-4 pb-3 backdrop-blur">
      <h1 className="text-3xl font-bold tracking-tight">{titre}</h1>
      {children}
    </header>
  )
}
