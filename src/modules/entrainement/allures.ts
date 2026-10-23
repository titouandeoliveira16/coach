import { formatMinSec } from '../../core/format'
import { tempsPredit, vitesseTenue } from '../../metrics/course'
import type { CourseRef, TypeCourse } from './types'

export interface LigneAllure {
  nom: string
  /** Vitesses (km/h) : une seule valeur ou une plage */
  kmh: [number, number?]
}

/**
 * Allures « Campus Coach » à partir d'une course de référence (Riegel) :
 * sans test, on repart de la VMA et du seuil en % de VMA des réglages.
 */
export function tableauAllures(ref: CourseRef | undefined, vmaKmh?: number, seuilPct = 87): LigneAllure[] | undefined {
  const r = ref ?? (vmaKmh ? { distanceM: ((vmaKmh * seuilPct) / 100) * 1000, tempsSec: 3600 } : undefined)
  if (!r) return undefined
  const s60 = vitesseTenue(r.distanceM, r.tempsSec, 3600)
  const surDistance = (m: number) => (m / 1000 / tempsPredit(r.distanceM, r.tempsSec, m)) * 3600
  return [
    { nom: 'Endurance fondamentale', kmh: [s60 * 0.7, s60 * 0.8] },
    { nom: 'Endurance active', kmh: [s60 * 0.8, s60 * 0.85] },
    { nom: 'Tempo', kmh: [s60 * 0.85, s60 * 0.9] },
    { nom: 'Allure marathon', kmh: [surDistance(42195)] },
    { nom: 'Allure semi', kmh: [surDistance(21097)] },
    { nom: 'Sweet spot', kmh: [s60 * 0.95] },
    { nom: 'Seuil 60', kmh: [s60] },
    { nom: 'Seuil 30', kmh: [vitesseTenue(r.distanceM, r.tempsSec, 1800)] },
    { nom: 'Allure 5 km', kmh: [surDistance(5000)] },
    { nom: 'VMA', kmh: [vitesseTenue(r.distanceM, r.tempsSec, 300)] },
  ]
}

const allure = (kmh: number) => `${formatMinSec(3600 / kmh)}/km`

/** "5'10-5'45/km" ou "3'50/km" (la plus lente d'abord). */
export const texteAllure = (l: LigneAllure) => (l.kmh[1] ? `${formatMinSec(3600 / l.kmh[0])}-${allure(l.kmh[1])}` : allure(l.kmh[0]))

/** Allure cible d'un type de séance Campus (si elle a un sens). */
export function allureDuType(t: TypeCourse | undefined, lignes: LigneAllure[] | undefined) {
  const nom = t === 'Sortie longue' ? 'Endurance fondamentale' : t
  const l = lignes?.find((x) => x.nom === nom)
  return l && texteAllure(l)
}
