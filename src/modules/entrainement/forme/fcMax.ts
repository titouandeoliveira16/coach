import { aujourdhui, decalerJour } from '../../../core/dates'
import { db } from '../../../core/db'

/** Au-delà, c'est presque sûrement un artefact du capteur. */
const FC_IMPOSSIBLE = 225

/**
 * FC la plus haute vue dans tes séances de l'année (vélo et course).
 * `isolee` : la 2e plus haute est loin derrière (plus de 6 bpm) → peut-être un artefact du capteur.
 */
export async function fcMaxObservee() {
  const depuis = decalerJour(aujourdhui(), -365)
  const l = (await db.seances.where('date').above(depuis).toArray())
    .filter((s) => (s.sport === 'velo' || s.sport === 'course') && s.fcMax && s.fcMax < FC_IMPOSSIBLE)
    .sort((a, b) => b.fcMax! - a.fcMax!)
  if (!l.length) return undefined
  const [premiere, deuxieme] = l
  return {
    fc: premiere.fcMax!, date: premiere.date, titre: premiere.titre ?? (premiere.sport === 'course' ? 'Course' : 'Vélo'),
    isolee: !!deuxieme && premiere.fcMax! - deuxieme.fcMax! > 6,
  }
}
