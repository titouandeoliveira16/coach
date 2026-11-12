import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { phaseDe, type Phase } from '../../../metrics/programme'
import { chargeHabituelle } from '../../../metrics/saison'

/**
 * Charge habituelle avant la semaine de ce lundi (12/11/2026) : tes 12 semaines complètes de vélo d'avant, l'affûtage et
 * la récupération prévus mis à part. Absente sans historique.
 */
export async function chargeDeDepart(lundi: string, phases: Phase[] = []) {
  const debut = decalerJour(lundi, -84)
  const seances = (await db.seances.where('date').between(debut, decalerJour(lundi, -1), true, true).toArray()).filter((s) => s.sport === 'velo')
  const semaines = Array.from({ length: 12 }, (_, i) => {
    const l = decalerJour(debut, 7 * i)
    const kj = seances.filter((s) => s.date >= l && s.date <= decalerJour(l, 6)).reduce((a, s) => a + (s.kj ?? 0), 0)
    const type = phases.length ? phaseDe(l, phases).phase.type : undefined
    return { kj, legere: type === 'affutage' || type === 'recuperation' }
  })
  return chargeHabituelle(semaines)
}
