/**
 * Suivi de la VFC (variabilité de la fréquence cardiaque).
 *
 * Références : Plews et al., 2012-2013 (Sports Med, Eur J Appl Physiol) ;
 * Vesterinen et al., 2016 (Med Sci Sports Exerc) ; Javaloyes et al., 2019 ;
 * méta-analyses Manresa-Rocamora et al., 2021 et Düking et al., 2021.
 *  - on travaille sur ln(RMSSD) ;
 *  - on juge la moyenne glissante sur 7 jours, pas la valeur du jour ;
 *  - zone normale = moyenne de la base ± 0,5 écart-type (plus petit changement significatif) ;
 *  - coefficient de variation (CV) sur 7 jours : une forte hausse signale une déstabilisation.
 */
import { moyenneEcartType } from './charge'

export interface JourVfc {
  date: string
  rmssd?: number
  fcRepos?: number
}

/** Jours de mesures nécessaires avant un premier signal. */
export const JOURS_MIN_BASE = 14
/** Fenêtre de la base (jours). */
export const JOURS_BASE = 60

export interface AnalyseVfc {
  /** Nombre de jours avec VFC dans la base */
  nBase: number
  /** Moyenne glissante 7 j de ln(RMSSD) (au moins 3 mesures) */
  ln7?: number
  /** ln(RMSSD) du jour */
  lnJour?: number
  zoneBasse?: number
  zoneHaute?: number
  /** CV de ln(RMSSD) sur 7 jours, en % */
  cv7?: number
  /** CV habituel (moyenne des CV 7 j sur la base), en % */
  cvBase?: number
  /** FC de repos : moyenne 7 j et moyenne de la base */
  fcRepos7?: number
  fcReposBase?: number
}

const moyenne = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined)

/**
 * Analyse au jour J. `jours` : mesures triées par date croissante, jusqu'à J inclus
 * (au plus 60 + 7 jours suffisent).
 */
export function analyserVfc(jours: JourVfc[], date: string): AnalyseVfc {
  const jusquA = jours.filter((j) => j.date <= date)
  const base = jusquA.slice(-JOURS_BASE)
  const sept = jusquA.filter((j) => j.date > decaler(date, -7))

  const lnBase = base.filter((j) => j.rmssd).map((j) => Math.log(j.rmssd!))
  const ln7Vals = sept.filter((j) => j.rmssd).map((j) => Math.log(j.rmssd!))
  const jour = jusquA.find((j) => j.date === date)

  const res: AnalyseVfc = { nBase: lnBase.length }
  if (jour?.rmssd) res.lnJour = Math.log(jour.rmssd)
  if (ln7Vals.length >= 3) {
    const { moyenne: m, ecartType } = moyenneEcartType(ln7Vals)
    res.ln7 = m
    res.cv7 = (ecartType / m) * 100
  }
  if (lnBase.length >= JOURS_MIN_BASE) {
    const { moyenne: m, ecartType } = moyenneEcartType(lnBase)
    res.zoneBasse = m - 0.5 * ecartType
    res.zoneHaute = m + 0.5 * ecartType
    // CV habituel : moyenne des CV sur des fenêtres de 7 mesures consécutives
    const cvs: number[] = []
    for (let i = 7; i <= lnBase.length; i++) {
      const f = moyenneEcartType(lnBase.slice(i - 7, i))
      cvs.push((f.ecartType / f.moyenne) * 100)
    }
    res.cvBase = moyenne(cvs)
  }
  const fc7 = sept.filter((j) => j.fcRepos).map((j) => j.fcRepos!)
  const fcBase = base.filter((j) => j.fcRepos).map((j) => j.fcRepos!)
  if (fc7.length >= 3) res.fcRepos7 = moyenne(fc7)
  if (fcBase.length >= JOURS_MIN_BASE) res.fcReposBase = moyenne(fcBase)
  return res
}

/** Décale une date "AAAA-MM-JJ" de n jours (calcul en UTC : pas d'effet heure d'été). */
export function decaler(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
