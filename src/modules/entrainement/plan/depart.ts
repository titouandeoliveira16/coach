import { db } from '../../../core/db'
import { aujourdhui, decalerJour } from '../../../core/dates'
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
export async function chargeDeDepart(lundi: string, phases: Phase[] = [], z2W?: number) {
  const debut = decalerJour(lundi, -7 * SEMAINES)
  const historique = ((await db.reglages.get('historique-kj'))?.valeur as HistoriqueKj | undefined)?.semaines ?? {}
  const seances = (await db.seances.where('date').between(debut, decalerJour(lundi, -1), true, true).toArray()).filter((s) => s.sport === 'velo')
  // Semaines pas encore finies (semaine construite à l'avance) : pas comptées, ce ne sont pas des arrêts (audit du 17/11/2026)
  const finies = Array.from({ length: SEMAINES }, (_, i) => decalerJour(debut, 7 * i)).filter((l) => decalerJour(l, 6) < aujourdhui()).length
  // 26/11/2026 : kJ de chaque semaine remis à ta puissance d'endurance d'aujourd'hui (celle de la semaine, sinon la plus
  // ancienne connue), comme le budget : une CP en hausse ne fait pas paraître ta charge habituelle plus basse
  const metas = new Map((await db.reglages.where('id').startsWith('semaine-').toArray()).map((x) => [x.id.slice(8), (x.valeur as { z2W?: number })?.z2W]))
  const z2Ancien = [...metas.entries()].filter(([, z]) => z).sort((a, b) => a[0].localeCompare(b[0]))[0]?.[1]
  const rapport = (l: string) => {
    const z = metas.get(l) ?? z2Ancien
    return z2W && z ? Math.min(1.15, Math.max(0.85, z2W / z)) : 1
  }
  const semaines = Array.from({ length: finies }, (_, i) => {
    const l = decalerJour(debut, 7 * i)
    const kj = rapport(l) * Math.max(historique[l] ?? 0, seances.filter((s) => s.date >= l && s.date <= decalerJour(l, 6)).reduce((a, s) => a + (s.kj ?? 0), 0))
    const type = phases.length ? phaseDe(l, phases).phase.type : undefined
    return { kj, legere: type === 'affutage' || type === 'recuperation' }
  })
  return chargeHabituelle(semaines)
}
