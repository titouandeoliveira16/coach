import { versJour } from '../../../core/dates'
import { trimpBanister } from '../../../metrics/charge'
import { decouplage, tempsParZone } from '../../../metrics/fc'
import { DUREES_MEILLEURS, kjDepuisEchantillons, meilleurePuissance, puissanceNormalisee, reechantillonner1Hz } from '../../../metrics/puissance'
import type { Contexte } from '../seances/donnees'
import { nouvelId } from '../seances/donnees'
import type { Seance, Sport } from '../types'

/** Flux d'une activité (fichier .FIT ou Intervals.icu), aligné sur le temps. Pas de GPS : inutile pour la charge. */
export interface Flux {
  /** Secondes depuis le départ */
  t: number[]
  fc?: (number | null)[]
  /** Puissance (W) */
  w?: (number | null)[]
  /** Vitesse (m/s) */
  v?: (number | null)[]
}

/** Résumé fourni par la source (plus fiable que le recalcul pour certaines valeurs). */
export interface Resume {
  sport: Sport
  debut: Date
  /** Temps en mouvement (s) */
  dureeSec?: number
  distanceM?: number
  deniveleM?: number
  homeTrainer?: boolean
  titre?: string
  source: Seance['source']
  idExterne?: string
}

const moyenne = (v: (number | null)[] | undefined) => {
  const x = (v ?? []).filter((n): n is number => n != null && n > 0)
  return x.length ? x.reduce((a, b) => a + b, 0) / x.length : undefined
}

/** Durée de séance en dessous de laquelle on ne calcule pas le découplage. */
const DUREE_MIN_DECOUPLAGE = 45 * 60

/** Transforme un flux + son résumé en séance, avec toutes les métriques calculées. */
export function analyserFlux(flux: Flux, r: Resume, c: Contexte): Seance {
  const { t } = flux
  const dureeSec = r.dureeSec ?? (t.length ? t[t.length - 1] - t[0] : 0)
  const fcMax = flux.fc ? Math.max(...flux.fc.filter((n): n is number => n != null)) : undefined
  const aFc = flux.fc?.some((n) => n != null && n > 0)
  const aPuissance = flux.w?.some((n) => n != null && n > 0)

  const s: Seance = {
    id: nouvelId(),
    date: versJour(r.debut),
    debut: r.debut.toISOString(),
    sport: r.sport,
    titre: r.titre,
    dureeSec: Math.round(dureeSec),
    distanceKm: r.distanceM ? Math.round(r.distanceM / 10) / 100 : undefined,
    deniveleM: r.deniveleM !== undefined ? Math.round(r.deniveleM) : undefined,
    homeTrainer: r.sport === 'velo' ? r.homeTrainer : undefined,
    source: r.source,
    idExterne: r.idExterne,
  }

  if (aFc) {
    s.fcMoy = Math.round(moyenne(flux.fc)!)
    s.fcMax = fcMax && Number.isFinite(fcMax) ? fcMax : undefined
    s.tempsZones = tempsParZone(t, flux.fc!, c.bornes).map(Math.round)
    s.trimp = trimpBanister(t, flux.fc!, c.fcRepos, c.fcMax)
    s.trimpFlux = true
  }
  if (aPuissance) {
    s.kj = Math.round(kjDepuisEchantillons(t, flux.w!))
    s.puissanceMoyW = dureeSec ? Math.round((s.kj * 1000) / dureeSec) : undefined
    const w1Hz = reechantillonner1Hz(t, flux.w!)
    const np = puissanceNormalisee(w1Hz)
    s.puissanceNormW = np ? Math.round(np) : undefined
    // Meilleurs efforts : estimation de la CP entre deux tests
    const meilleurs: Record<string, number> = {}
    for (const d of DUREES_MEILLEURS) {
      const m = meilleurePuissance(w1Hz, d)
      if (m) meilleurs[d] = Math.round(m)
    }
    if (Object.keys(meilleurs).length) s.meilleurs = meilleurs
  }
  if (aFc && dureeSec >= DUREE_MIN_DECOUPLAGE) {
    const sortie = aPuissance ? flux.w! : flux.v
    if (sortie) {
      const d = decouplage(t, flux.fc!, sortie)
      if (d !== undefined) s.decouplage = Math.round(d * 10) / 10
    }
  }
  return s
}
