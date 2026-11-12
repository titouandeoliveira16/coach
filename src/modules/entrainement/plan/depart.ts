import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { phaseDe, type Phase } from '../../../metrics/programme'
import { chargeHabituelle } from '../../../metrics/saison'

const SEMAINES = 26

/** Réglage « historique-kj » : kJ de vélo par semaine (lundi) sur 6 mois, importés une fois d'Intervals. */
export interface HistoriqueKj {
  semaines: Record<string, number>
  le: string
  /** 2 : sorties en double retirées (12/11/2026) */
  version?: number
  /** Dernière lecture (ISO) : relu au plus une fois par heure */
  lu?: string
  viaStrava?: number
  /** Premier import ; relu une fois par jour pendant 30 jours tant que des sorties viennent de Strava (absentes) */
  debut?: string
  /** Relecture qui a trouvé nettement plus de kJ (sorties Garmin reliées à Intervals) : plus de relecture */
  complet?: boolean
}

/**
 * Charge habituelle avant la semaine de ce lundi (12/11/2026) : tes 26 semaines (6 mois) complètes de vélo d'avant,
 * l'affûtage et la récupération prévus mis à part. Chaque semaine : tes séances, ou le total importé une fois d'Intervals
 * (réglage « historique-kj », kJ estimés pour les sorties sans capteur), le plus grand des deux. Absente sans historique.
 */
export async function chargeDeDepart(lundi: string, phases: Phase[] = []) {
  const debut = decalerJour(lundi, -7 * SEMAINES)
  const historique = ((await db.reglages.get('historique-kj'))?.valeur as HistoriqueKj | undefined)?.semaines ?? {}
  const seances = (await db.seances.where('date').between(debut, decalerJour(lundi, -1), true, true).toArray()).filter((s) => s.sport === 'velo')
  const semaines = Array.from({ length: SEMAINES }, (_, i) => {
    const l = decalerJour(debut, 7 * i)
    const kj = Math.max(historique[l] ?? 0, seances.filter((s) => s.date >= l && s.date <= decalerJour(l, 6)).reduce((a, s) => a + (s.kj ?? 0), 0))
    const type = phases.length ? phaseDe(l, phases).phase.type : undefined
    return { kj, legere: type === 'affutage' || type === 'recuperation' }
  })
  return chargeHabituelle(semaines)
}
