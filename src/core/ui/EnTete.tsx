import type { ReactNode } from 'react'

/** Titre de page, collé en haut et sous l'encoche de l'iPhone. */
export function EnTete({ titre, aDroite, children }: { titre: string; aDroite?: ReactNode; children?: ReactNode }) {
  return (
    <header className="pt-sur sticky top-0 z-10 bg-fond px-4 pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="titre-ecran min-w-0 truncate text-[26px]">{titre}</h1>
        {aDroite && <span className="shrink-0 whitespace-nowrap text-sm text-texte-2">{aDroite}</span>}
      </div>
      {children}
    </header>
  )
}
