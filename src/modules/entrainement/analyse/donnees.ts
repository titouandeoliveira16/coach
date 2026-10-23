import { db } from '../../../core/db'
import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { contrainte, modeleForme, monotonie, ratioPic, type PointForme } from '../../../metrics/charge'
import { analyserVfc, type AnalyseVfc } from '../../../metrics/vfc'
import { calculerSignal, type Signal } from '../../../metrics/signal'
import { scoreRessenti } from '../forme/donnees'
import { chargeDe, chargerContexte, domaineDe, type Contexte } from '../seances/donnees'
import type { Intensite, MesureMatin, Seance } from '../types'

/** Jours d'historique de charge nécessaires avant d'afficher CTL / TSB (amorçage). */
export const JOURS_AMORCAGE = 28

export type FiltreSport = 'velo' | 'course' | 'total'

/** Charge de chaque jour entre deux dates (incluses), jours sans séance = 0. */
export function chargesParJour(seances: Seance[], c: Contexte, du: string, au: string, sport: FiltreSport = 'total') {
  const parJour = new Map<string, number>()
  for (const s of seances) {
    if (sport !== 'total' && s.sport !== sport) continue
    parJour.set(s.date, (parJour.get(s.date) ?? 0) + chargeDe(s, c))
  }
  const res: { date: string; charge: number }[] = []
  for (let d = du; d <= au; d = decalerJour(d, 1)) res.push({ date: d, charge: parJour.get(d) ?? 0 })
  return res
}

/** Somme des charges par semaine (lundi → charge), des n dernières semaines terminées avant `lundi`. */
export function chargesHebdo(seances: Seance[], c: Contexte, lundi: string, n: number, sport: FiltreSport = 'total') {
  return Array.from({ length: n }, (_, i) => {
    const debut = decalerJour(lundi, -7 * (n - i))
    return chargesParJour(seances, c, debut, decalerJour(debut, 6), sport).reduce((a, x) => a + x.charge, 0)
  })
}

/** Temps (s) par domaine d'intensité sur un ensemble de séances. */
export function distribution(seances: Seance[], c: Contexte): Record<Intensite, number> {
  const d = { basse: 0, moyenne: 0, haute: 0 }
  for (const s of seances) {
    if (s.tempsZones) {
      d.basse += s.tempsZones[0] + s.tempsZones[1]
      d.moyenne += s.tempsZones[2]
      d.haute += s.tempsZones[3] + s.tempsZones[4]
    } else d[domaineDe(s, c.bornes)] += s.dureeSec
  }
  return d
}

/** Part du temps en « kJ faciles » (RPE < 3) et en « stress » (RPE ≥ 7,5), règle du PDF. */
export function partsRpe(seances: Seance[]) {
  const notees = seances.filter((s) => s.rpe !== undefined)
  const total = notees.reduce((a, s) => a + s.dureeSec, 0)
  if (!total) return undefined
  const faciles = notees.filter((s) => s.rpe! < 3).reduce((a, s) => a + s.dureeSec, 0)
  const stress = notees.filter((s) => s.rpe! >= 7.5).reduce((a, s) => a + s.dureeSec, 0)
  const kjFaciles = notees.filter((s) => s.rpe! < 3).reduce((a, s) => a + (s.kj ?? 0), 0)
  const kjStress = notees.filter((s) => s.rpe! >= 7.5).reduce((a, s) => a + (s.kj ?? 0), 0)
  return { faciles: faciles / total, stress: stress / total, kjFaciles, kjStress }
}

export interface Analyse {
  contexte: Contexte
  seances: Seance[]
  mesures: MesureMatin[]
  /** Courbe forme/fatigue (total), du premier jour d'historique à aujourd'hui */
  forme: PointForme[]
  /** Vrai tant qu'il y a moins de 28 jours d'historique de charge */
  amorcage: boolean
  joursHistorique: number
  vfc: AnalyseVfc
  signal: Signal
  /** Signal des 2 jours précédents (garde-fou « médecin ») */
  signauxPrecedents: Signal[]
  monotonie?: number
  contrainte?: number
  ratioPic?: number
}

/** Signal d'un jour donné, calculé uniquement avec les données disponibles ce jour-là. */
function signalDu(date: string, a: Omit<Analyse, 'signal' | 'signauxPrecedents' | 'vfc'>, maladeDates: Set<string>) {
  const vfc = analyserVfc(a.mesures.map((m) => ({ date: m.date, rmssd: m.vfcMs, fcRepos: m.fcRepos })), date)
  const matin = a.mesures.find((m) => m.date === date)
  const point = a.forme.find((p) => p.date === date)
  const charges = chargesParJour(a.seances, a.contexte, decalerJour(date, -6), date)
  const charge7 = charges.reduce((s, x) => s + x.charge, 0)
  // Les 4 semaines qui précèdent la fenêtre des 7 derniers jours
  const hebdo = chargesHebdo(a.seances, a.contexte, decalerJour(date, -6), 4)
  const signal = calculerSignal({
    vfc,
    ressenti: matin ? scoreRessenti(matin) : undefined,
    sommeil: matin?.sommeil,
    tsb: a.amorcage ? undefined : point?.tsb,
    ratioPic: a.joursHistorique >= 35 ? ratioPic(charge7, hebdo) : undefined,
    atlSurCtl: point && point.ctl > 0 ? point.atl / point.ctl : undefined,
    maladeOuDouleur: maladeDates.has(date),
  })
  return { vfc, signal }
}

/** Calcule toute l'analyse du jour (lue en direct par les écrans). */
export async function analyser(date = aujourdhui()): Promise<Analyse> {
  const contexte = await chargerContexte()
  const seances = await db.seances.toArray()
  const mesures = await db.mesures.where('date').between(decalerJour(date, -70), date, true, true).toArray()
  const indispos = await db.indispos.toArray()
  const maladeDates = new Set(indispos.filter((i) => i.raison === 'Malade' || i.raison === 'Douleur / blessure').map((i) => i.date))

  const premier = seances.reduce((min, s) => (s.date < min ? s.date : min), date)
  const debut = decalerJour(premier < decalerJour(date, -365) ? decalerJour(date, -365) : premier, 0)
  const forme = modeleForme(chargesParJour(seances, contexte, debut, date))
  const joursHistorique = seances.length ? ecartJours(premier, date) + 1 : 0
  const base = { contexte, seances, mesures, forme, amorcage: joursHistorique < JOURS_AMORCAGE, joursHistorique }

  const { vfc, signal } = signalDu(date, base, maladeDates)
  const signauxPrecedents = [1, 2].map((n) => signalDu(decalerJour(date, -n), base, maladeDates).signal)
  const charges7 = chargesParJour(seances, contexte, decalerJour(date, -6), date).map((x) => x.charge)
  const charge7 = charges7.reduce((a, b) => a + b, 0)

  return {
    ...base,
    vfc,
    signal,
    signauxPrecedents,
    monotonie: monotonie(charges7),
    contrainte: contrainte(charges7),
    ratioPic: ratioPic(charge7, chargesHebdo(seances, contexte, decalerJour(date, -6), 4)),
  }
}
