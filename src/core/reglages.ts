import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { enregistrer } from './stockage'

/**
 * Lit un réglage (objet) dans la base et le tient à jour automatiquement.
 * Renvoie la valeur (ou la valeur par défaut) et une fonction pour la modifier en partie.
 */
export function useReglage<T extends object>(cle: string, defaut: T) {
  const ligne = useLiveQuery(() => db.reglages.get(cle), [cle])
  const valeur: T = { ...defaut, ...(ligne?.valeur as Partial<T> | undefined) }

  // Lecture + écriture dans une même transaction : deux champs modifiés
  // coup sur coup ne s'écrasent pas l'un l'autre.
  const modifier = (changements: Partial<T>) =>
    db.transaction('rw', db.reglages, async () => {
      const actuel = (await db.reglages.get(cle))?.valeur as Partial<T> | undefined
      await enregistrer(db.reglages, { id: cle, valeur: { ...defaut, ...actuel, ...changements } })
    })

  return [valeur, modifier] as const
}
