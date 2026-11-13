import type { Role } from '../../../metrics/programme'
import { heuresAu, programmeAu } from '../reglagesEntrainement'
import type { ReglagesProgramme, SemaineTypeFuture } from '../types'

export const TRANCHES_HEURES = ['Moins de 4 h', '4 à 6 h', '6 à 8 h', '8 à 10 h', '10 à 12 h', 'Plus de 12 h']

/** Ce que change le conseil de Saison (13/11/2026) : un jour de vélo, des sorties plus longues ou plus de temps par semaine. */
export type Changement =
  | { levier: 'jour'; jour: number }
  | { levier: 'semaine'; minutes: number }
  | { levier: 'longue'; minutes: number }
  | { levier: 'heures' }

/** Tranche d'heures au-dessus (absente au maximum). */
export const trancheAuDessus = (h?: string) => {
  const i = TRANCHES_HEURES.indexOf(h ?? '4 à 6 h')
  return i >= 0 && i < TRANCHES_HEURES.length - 1 ? TRANCHES_HEURES[i + 1] : undefined
}

/**
 * Applique le conseil à partir du lundi `lundi` : une semaine type à venir (« Plus tard ») à cette date, créée depuis la
 * semaine type qui s'y applique, ou modifiée si elle existe ; les semaines types à venir d'après reçoivent le même
 * changement (sinon elles l'annuleraient à leur date).
 */
export function appliquerChangement(prog: ReglagesProgramme, heuresProfil: string | undefined, lundi: string, c: Changement): ReglagesProgramme {
  const futures = prog.semainesTypesFutures ?? []
  const base = programmeAu(prog, lundi)
  const existante = futures.find((f) => f.debut === lundi)
  const depart: SemaineTypeFuture = existante ?? { debut: lundi, semaineType: base.semaineType, maxSemaineMin: base.maxSemaineMin, maxLongMin: base.maxLongMin }
  const heures = trancheAuDessus(heuresAu(prog, heuresProfil, lundi))
  const changer = (f: SemaineTypeFuture): SemaineTypeFuture => {
    if (c.levier === 'jour') {
      if (f.semaineType[c.jour].startsWith('velo')) return f
      return { ...f, semaineType: f.semaineType.map((r, i) => (i === c.jour ? 'velo-z2' : r)) as Role[] }
    }
    if (c.levier === 'semaine') return { ...f, maxSemaineMin: Math.max(f.maxSemaineMin ?? prog.maxSemaineMin, c.minutes) }
    if (c.levier === 'longue') return { ...f, maxLongMin: Math.max(f.maxLongMin ?? prog.maxLongMin, c.minutes) }
    if (!heures) return f
    return TRANCHES_HEURES.indexOf(f.heuresSemaine ?? '') >= TRANCHES_HEURES.indexOf(heures) ? f : { ...f, heuresSemaine: heures }
  }
  const autres = futures.filter((f) => f.debut !== lundi).map((f) => (f.debut > lundi ? changer(f) : f))
  return { ...prog, semainesTypesFutures: [...autres, changer(depart)].sort((a, b) => a.debut.localeCompare(b.debut)) }
}
