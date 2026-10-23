import { db } from '../../../core/db'
import { enregistrer } from '../../../core/stockage'
import { aujourdhui, decalerJour } from '../../../core/dates'
import type { MesureMatin, Note } from '../types'

/** Les 5 questions du ressenti, dans l'ordre d'affichage. */
export const QUESTIONS: { cle: 'sommeil' | 'energie' | 'jambes' | 'motivation' | 'serenite'; libelle: string; bornes: [string, string] }[] = [
  { cle: 'sommeil', libelle: 'Sommeil', bornes: ['Très mauvais', 'Excellent'] },
  { cle: 'energie', libelle: 'Énergie', bornes: ['Épuisé', 'Plein de jus'] },
  { cle: 'jambes', libelle: 'Jambes', bornes: ['Très lourdes', 'Légères'] },
  { cle: 'motivation', libelle: 'Motivation', bornes: ['Aucune', 'Au top'] },
  { cle: 'serenite', libelle: 'Stress', bornes: ['Très stressé', 'Serein'] },
]

/** Moyenne des notes de ressenti renseignées (1 à 5), ou undefined. */
export function scoreRessenti(m: MesureMatin): number | undefined {
  const notes = QUESTIONS.map((q) => m[q.cle]).filter((n): n is Note => n !== undefined)
  return notes.length ? notes.reduce<number>((a, b) => a + b, 0) / notes.length : undefined
}

/** Enregistre (ou remplace) la mesure d'un jour. */
export const enregistrerMesure = (m: Omit<MesureMatin, 'modifieLe'>) =>
  enregistrer(db.mesures, { ...m, modifieLe: new Date().toISOString() })

/** Mesures des n derniers jours (aujourd'hui compris), de la plus récente à la plus ancienne. */
export const mesuresRecentes = (n: number) =>
  db.mesures
    .where('date')
    .between(decalerJour(aujourdhui(), -(n - 1)), aujourdhui(), true, true)
    .reverse()
    .toArray()

/** Moyenne d'une valeur sur les mesures fournies (ignore les jours sans valeur). */
export function moyenne(mesures: MesureMatin[], cle: 'vfcMs' | 'fcRepos'): { valeur: number; nb: number } | undefined {
  const v = mesures.map((m) => m[cle]).filter((x): x is number => x !== undefined)
  return v.length ? { valeur: v.reduce((a, b) => a + b, 0) / v.length, nb: v.length } : undefined
}
