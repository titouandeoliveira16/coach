import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { EnTete } from '../core/ui/EnTete'
import type { ModuleApp } from './modules'

/** Réglages d'un module : uniquement ce qui le concerne. Compte, notifications et version : Accueil → ⚙️. */
export function Reglages({ module }: { module: ModuleApp }) {
  return (
    <>
      <EnTete titre="Réglages" />
      <div className="space-y-3 px-4">
        {module.SectionReglages && (
          <div style={{ '--accent': module.couleur, '--color-accent': module.couleur } as CSSProperties} className="space-y-3">
            <module.SectionReglages />
          </div>
        )}
        <Link to="/reglages" className="block py-2 text-center text-sm text-texte-3">Compte, notifications et version : Accueil → ⚙️ ›</Link>
      </div>
    </>
  )
}
