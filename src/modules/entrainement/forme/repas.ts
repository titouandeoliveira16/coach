import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { db, type JournalRepas } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { maintienMesure, tendancePoids } from '../../../metrics/nutrition'
import { besoinsDe, lireReglagesNutrition } from './besoins'
import { peseesValides } from './pesees'

/** Premier jour du journal des repas */
export const DEBUT_JOURNAL = '2026-10-26'

/** kcal d'après les macros (4 kcal/g de protéines et de glucides, 9 kcal/g de lipides) */
export const kcalDesMacros = (r: Pick<JournalRepas, 'proteines' | 'glucides' | 'lipides'>) =>
  r.proteines !== undefined && r.glucides !== undefined && r.lipides !== undefined
    ? Math.round(4 * r.proteines + 4 * r.glucides + 9 * r.lipides)
    : undefined

export const enregistrerRepas = (r: JournalRepas) => enregistrer(db.repas, r)

/**
 * Jour à remplir : aujourd'hui à partir de 18 h ; sinon hier s'il a été oublié.
 * Renvoie aussi la saisie existante (pour l'afficher ou la modifier).
 */
export async function jourARemplir(maintenant = new Date()) {
  const jour = aujourdhui()
  const hier = decalerJour(jour, -1)
  const duJour = await db.repas.get(jour)
  if (duJour) return { jour, saisie: duJour }
  if (maintenant.getHours() >= 18) return { jour, saisie: undefined }
  if (hier >= DEBUT_JOURNAL && !(await db.repas.get(hier))) return { jour: hier, saisie: undefined }
  return undefined
}

/** Suivi sur n jours : mangé vs besoin estimé, jour par jour. */
export async function suiviRepas(n = 28) {
  const fin = aujourdhui()
  const jours = Array.from({ length: n }, (_, i) => decalerJour(fin, i - n + 1)).filter((j) => j >= DEBUT_JOURNAL)
  const lignes = []
  for (const j of jours) {
    const r = await db.repas.get(j)
    const b = await besoinsDe(j)
    lignes.push({ jour: j, repas: r?.nonRenseigne ? undefined : r, besoin: b.kcal, cibles: { proteines: b.proteines, glucides: b.glucides, lipides: b.lipides }, kg: b.kg })
  }
  return lignes
}

/**
 * Maintien mesuré (à partir de 3 semaines de repas notés et de pesées) : proposé quand il s'écarte
 * de plus de 100 kcal de ce que l'appli utilise. Une fois validé, pas de nouvelle proposition avant 3 semaines.
 */
export async function calibration() {
  const n = await lireReglagesNutrition()
  const jour = aujourdhui()
  if (n.calibrationPlusTard && n.calibrationPlusTard > jour) return undefined
  if (n.correctionLe && ecartJours(n.correctionLe, jour) < 21) return undefined
  const repas = (await db.repas.where('date').between(decalerJour(jour, -28), decalerJour(jour, -1), true, true).toArray())
    .filter((r) => !r.nonRenseigne && r.kcal)
  if (repas.length < 15 || ecartJours(repas.map((r) => r.date).sort()[0], jour) < 21) return undefined
  const tendance = tendancePoids(await peseesValides(), jour)
  if (tendance === undefined) return undefined
  let formule = 0
  for (const r of repas) formule += (await besoinsDe(r.date, { sansCorrection: true, sansEtalement: true })).maintien
  const kcalMoyen = repas.reduce((a, r) => a + r.kcal!, 0) / repas.length
  const m = maintienMesure({ kcalMoyen, formuleMoyenne: formule / repas.length, tendanceKgSemaine: tendance })
  if (Math.abs(m.ecart - (n.correction ?? 0)) < 100) return undefined
  return { ...m, formule: Math.round(formule / repas.length / 10) * 10, kcalMoyen: Math.round(kcalMoyen / 10) * 10, tendance, jours: repas.length }
}
