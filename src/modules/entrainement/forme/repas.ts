import { aujourdhui, decalerJour, ecartJours } from '../../../core/dates'
import { db, type JournalRepas } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { maintienMesure, tendancePoids } from '../../../metrics/nutrition'
import { besoinsDe, lireReglagesNutrition, modifierReglagesNutrition } from './besoins'
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
 * Maintien mesuré, à partir des repas notés et des pesées :
 *  - provisoire dès 14 jours (≥ 10 repas et ≥ 10 pesées) : proposé si l'écart dépasse 150 kcal, borné à ±250 ;
 *  - confirmé à 3 semaines (≥ 15 repas) : proposé si l'écart dépasse 100 kcal, borné à ±500 (relecture du 29/10).
 * Une fois validé, pas de nouvelle proposition avant 3 semaines, sauf la confirmation d'une valeur provisoire (7 jours après).
 */
export async function calibration() {
  const n = await lireReglagesNutrition()
  const jour = aujourdhui()
  if (n.calibrationPlusTard && n.calibrationPlusTard > jour) return undefined
  if (n.correctionLe && ecartJours(n.correctionLe, jour) < (n.correctionProvisoire ? 7 : 21)) return undefined
  const repas = (await db.repas.where('date').between(decalerJour(jour, -28), decalerJour(jour, -1), true, true).toArray())
    .filter((r) => !r.nonRenseigne && r.kcal)
  if (!repas.length) return undefined
  const duree = ecartJours(repas.map((r) => r.date).sort()[0], jour)
  const confirme = repas.length >= 15 && duree >= 21
  if (!confirme && (n.correctionProvisoire || repas.length < 10 || duree < 14)) return undefined
  const tendance = confirme ? tendancePoids(await peseesValides(), jour) : tendancePoids(await peseesValides(), jour, 28, 12, 10)
  if (tendance === undefined) return undefined
  let formule = 0
  for (const r of repas) formule += (await besoinsDe(r.date, { sansCorrection: true, sansEtalement: true })).maintien
  const kcalMoyen = repas.reduce((a, r) => a + r.kcal!, 0) / repas.length
  const m = maintienMesure({ kcalMoyen, formuleMoyenne: formule / repas.length, tendanceKgSemaine: tendance, borne: confirme ? 500 : 250 })
  if (Math.abs(m.ecart - (n.correction ?? 0)) < (confirme ? 100 : 150)) {
    // Valeur provisoire confirmée par 3 semaines de données : elle devient définitive
    if (confirme && n.correctionProvisoire) await modifierReglagesNutrition({ correctionProvisoire: false })
    return undefined
  }
  return { ...m, provisoire: !confirme, formule: Math.round(formule / repas.length / 10) * 10, kcalMoyen: Math.round(kcalMoyen / 10) * 10, tendance, jours: repas.length }
}
