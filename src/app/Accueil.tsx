import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { IconeReglages } from '../core/ui/icones'
import { MODULES } from './modules'

/** Accueil : un gros bouton par module. */
export function Accueil() {
  const heure = new Date().getHours()
  const salut = heure < 18 ? 'Bonjour' : 'Bonsoir'
  return (
    <div className="pt-sur px-4">
      <div className="flex items-start justify-between pt-6">
        <h1 className="text-3xl font-bold tracking-tight">{salut} 👋</h1>
        <Link to="/reglages" aria-label="Réglages" className="p-1 text-texte-3"><IconeReglages className="h-7 w-7" /></Link>
      </div>
      <p className="mt-1 text-texte-2">Que veux-tu ouvrir ?</p>
      <div className="mt-6 space-y-3">
        {MODULES.map(({ id, nom, description, bientot, chemin, couleur, Icone }) => (
          <Link key={id} to={chemin} style={{ '--c': couleur } as CSSProperties}
            className={`flex items-center gap-4 rounded-3xl border border-bordure bg-surface p-5 active:scale-[0.98] ${bientot ? 'opacity-60' : ''}`}>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in srgb, ${couleur} 18%, transparent)`, color: couleur }}>
              <Icone className="h-8 w-8" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-bold">{nom}</span>
              <span className="block text-sm text-texte-2">{description}</span>
            </span>
            <span className="text-2xl text-texte-3">›</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
