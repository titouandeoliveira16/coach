import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { db } from '../../../core/db'
import { PROFIL_DEFAUT, type Profil } from '../../../core/profil'
import { DEFICIT_BASE, DUREE_PAUSE, propositionNutrition, tendancePoids, type BilanNutrition, type Proposition } from '../../../metrics/nutrition'
import { lireReglagesNutrition, modifierReglagesNutrition } from './besoins'
import { peseesValides, poidsAu } from './pesees'

/** Dimanche du bilan à faire : aujourd'hui le dimanche, celui de la veille ou de l'avant-veille le lundi et le mardi. */
export function dimancheDuBilan(jour = aujourdhui()) {
  const j = new Date(`${jour}T12:00:00`).getDay()
  return j === 0 ? jour : j === 1 ? decalerJour(jour, -1) : j === 2 ? decalerJour(jour, -2) : undefined
}

export async function enregistrerBilan(b: BilanNutrition) {
  const n = await lireReglagesNutrition()
  const bilans = [b, ...(n.bilans ?? []).filter((x) => x.date !== b.date)].sort((x, y) => y.date.localeCompare(x.date))
  await modifierReglagesNutrition({ bilans })
}

/** Proposition du bilan d'un dimanche (perte de gras seulement) : tendance du poids sur 14 et 21 jours, faim, énergie. */
export async function propositionDuBilan(dimanche: string): Promise<Proposition | undefined> {
  const profil = { ...PROFIL_DEFAUT, ...((await db.reglages.get('profil'))?.valeur as Profil | undefined) }
  if (profil.objectif !== 'perte') return undefined
  const n = await lireReglagesNutrition()
  const pesees = await peseesValides()
  const kg = (await poidsAu(dimanche)) ?? profil.poidsKg ?? 76
  return propositionNutrition({
    tendance14: tendancePoids(pesees, dimanche, 14, 10, 4),
    tendance21: tendancePoids(pesees, dimanche, 21, 17, 6),
    kg,
    bilans: (n.bilans ?? []).filter((b) => b.date <= dimanche),
    deficitBase: n.deficitBase ?? DEFICIT_BASE,
    joursDepuisAjustement: n.deficitLe ? ecartJours(n.deficitLe, dimanche) : undefined,
    pauseRecente: !!n.pauseJusquau && n.pauseJusquau < dimanche && ecartJours(n.pauseJusquau, dimanche) < 21,
  })
}

/** Valider (ou écarter) la proposition : le déficit de base change, ou pause de 7 jours au maintien. */
export async function appliquerProposition(dimanche: string, p?: Proposition) {
  const n = await lireReglagesNutrition()
  const jour = aujourdhui()
  if (p?.type === 'ajuster') await modifierReglagesNutrition({ deficitBase: (n.deficitBase ?? DEFICIT_BASE) + p.delta, deficitLe: jour, propositionVue: dimanche })
  else if (p?.type === 'pause') await modifierReglagesNutrition({ pauseJusquau: decalerJour(jour, DUREE_PAUSE - 1), propositionVue: dimanche })
  else await modifierReglagesNutrition({ propositionVue: dimanche })
}
