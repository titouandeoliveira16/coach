import { ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { IconeAide } from '../core/ui/icones'
import { EnTete } from '../core/ui/EnTete'
import type { ModuleApp } from './modules'

/** Réglages d'un module : uniquement ce qui le concerne (compte, notifications et version : Accueil → ⚙️). */
export function Reglages({ module }: { module: ModuleApp }) {
  return (
    <>
      <EnTete titre="Réglages" />
      <div className="space-y-3 px-4">
        {/* Mode d'emploi : ici plutôt que dans la barre du bas (place gardée pour ce qui sert tous les jours) */}
        {module.ModeEmploi && (
          <Link to={`${module.chemin}/aide`} className="presse flex items-center gap-3 rounded-[14px] bg-surface p-4">
            <span className="shrink-0" style={{ color: module.couleur }}><IconeAide className="h-5 w-5" /></span>
            <span className="flex-1 font-semibold">Mode d'emploi</span>
            <ChevronRight className="h-5 w-5 text-texte-3" strokeWidth={1.8} />
          </Link>
        )}
        {module.SectionReglages && (
          <div style={{ '--accent': module.couleur, '--color-accent': module.couleur } as CSSProperties} className="space-y-3">
            <module.SectionReglages />
          </div>
        )}
      </div>
    </>
  )
}
