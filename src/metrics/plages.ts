import type { AnalyseVfc } from './vfc'
import { SEUILS_DEFAUT } from './signal'

/**
 * Plages de « Ta forme » (maquette P, 12/11/2026) : pour chaque signal, ta normale (zone grise) et ta valeur (le point),
 * avec les mêmes bornes que les règles du feu, pour que le dessin dise la même chose que le feu :
 *  - récupération : moyenne 7 j de la VFC dans ta zone (moyenne ± 0,5 écart-type de ln RMSSD sur 60 j) ;
 *  - pouls : moyenne 7 j de la FC de repos, alerte au-delà de ta base + 5 bpm ;
 *  - sommeil : moyenne des 7 nuits, alerte sous 7 h ou sous ta normale des 30 nuits d'avant − 45 min.
 */
export interface Plage {
  cle: 'recuperation' | 'pouls' | 'sommeil'
  libelle: string
  /** Ta valeur (absente : pas encore assez de mesures) */
  valeur?: number
  /** Ta normale */
  bas?: number
  haut?: number
  /** Échelle de la barre */
  min: number
  max: number
  /** Texte de la valeur, quand ce n'est pas la moyenne (ex. « 49 · 49 bpm » des 2 derniers matins) */
  texte?: string
}

function echelle(bas: number, haut: number, valeur?: number) {
  const marge = Math.max(haut - bas, 0.0001)
  let min = bas - marge, max = haut + marge
  if (valeur !== undefined) {
    min = Math.min(min, valeur - marge * 0.2)
    max = Math.max(max, valeur + marge * 0.2)
  }
  return { min, max }
}

export function plagesForme(vfc: AnalyseVfc, sommeil: { moyenne7?: number; moyenne30?: number }, s = SEUILS_DEFAUT): Plage[] {
  const res: Plage[] = []
  // Récupération (en ms)
  const vVfc = vfc.ln7 !== undefined ? Math.exp(vfc.ln7) : undefined
  if (vfc.zoneBasse !== undefined && vfc.zoneHaute !== undefined) {
    const bas = Math.exp(vfc.zoneBasse), haut = Math.exp(vfc.zoneHaute)
    res.push({ cle: 'recuperation', libelle: 'Récupération · 7 jours', valeur: vVfc, bas, haut, ...echelle(bas, haut, vVfc) })
  } else res.push({ cle: 'recuperation', libelle: 'Récupération · 7 jours', valeur: vVfc, min: 0, max: 1 })
  // Pouls au repos (bpm)
  // Alerte « 2 matins de suite » (25/11/2026) : la ligne montre ces 2 matins, pour que le point et la couleur disent la même
  // chose (avant, la moyenne 7 j restait dans la plage alors que la ligne passait en orange)
  const deux = vfc.fcReposDeuxJours
  if (deux && vfc.fcReposBaseAvant !== undefined && deux.every((v) => v > vfc.fcReposBaseAvant! + s.fcReposEcart)) {
    const base = vfc.fcReposBaseAvant, bas = base - s.fcReposEcart, haut = base + s.fcReposEcart, v = (deux[0] + deux[1]) / 2
    res.push({ cle: 'pouls', libelle: 'Pouls au repos · 2 derniers matins', valeur: v, bas, haut, ...echelle(bas, haut, v), texte: `${deux.join(' · ')} bpm (habituel ${Math.round(base)})` })
  } else if (vfc.fcReposBase !== undefined) {
    const bas = vfc.fcReposBase - s.fcReposEcart, haut = vfc.fcReposBase + s.fcReposEcart
    res.push({ cle: 'pouls', libelle: 'Pouls au repos · 7 jours', valeur: vfc.fcRepos7, bas, haut, ...echelle(bas, haut, vfc.fcRepos7) })
  } else res.push({ cle: 'pouls', libelle: 'Pouls au repos · 7 jours', valeur: vfc.fcRepos7, min: 0, max: 1 })
  // Sommeil (h)
  const bas = Math.max(s.moyenne7MinH, sommeil.moyenne30 !== undefined ? sommeil.moyenne30 - s.ecartPersoH : s.moyenne7MinH)
  const haut = Math.max(bas + 0.5, sommeil.moyenne30 !== undefined ? sommeil.moyenne30 + s.ecartPersoH : 9)
  res.push({ cle: 'sommeil', libelle: 'Sommeil · 7 nuits', valeur: sommeil.moyenne7, bas, haut, ...echelle(bas, haut, sommeil.moyenne7) })
  return res
}

/** Position (0-100 %) d'une valeur sur l'échelle d'une plage, bornée. */
export const positionPct = (p: Plage, v: number) => Math.min(100, Math.max(0, ((v - p.min) / (p.max - p.min)) * 100))
