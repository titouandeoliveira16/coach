import { Bike, Dumbbell, Footprints, House, PersonStanding, Waves, type LucideIcon } from 'lucide-react'
import type { Sport } from './types'

const ICONES: Record<Sport, LucideIcon> = { velo: Bike, course: Footprints, natation: Waves, renfo: Dumbbell, autre: PersonStanding }

/** Icône d'un sport (Lucide, DESIGN.md) ; vélo d'intérieur : la maison. */
export function IconeSport({ sport, homeTrainer, className = 'inline h-4 w-4 -mt-0.5 mr-1.5 text-texte-2' }: { sport: Sport; homeTrainer?: boolean; className?: string }) {
  const I = sport === 'velo' && homeTrainer ? House : ICONES[sport] ?? PersonStanding
  return <I className={className} strokeWidth={1.8} aria-hidden />
}
