import type { Table } from 'dexie'
import { db } from './db'

/**
 * Toutes les écritures de données passent par ici :
 * chaque ligne reçoit une date de modification (_modifie),
 * ce qui permet à la synchronisation de savoir quoi envoyer
 * et quelle version garder en cas de conflit (la plus récente).
 */

/** Champs techniques ajoutés à chaque ligne */
export interface Horodate {
  /** Date de la dernière modification (sur cet appareil ou un autre) */
  _modifie?: string
  /** Vrai si cette version vient du serveur : inutile de la lui renvoyer */
  _recu?: boolean
}

type Ecouteur = () => void
const ecouteurs = new Set<Ecouteur>()

/** Prévient (ex. la synchro) qu'une donnée locale vient de changer. */
export function surEcriture(ecouteur: Ecouteur) {
  ecouteurs.add(ecouteur)
  return () => ecouteurs.delete(ecouteur)
}
const prevenir = () => ecouteurs.forEach((e) => e())

/** Ajoute ou remplace une ligne. */
export async function enregistrer<T>(table: Table<T, string>, ligne: NoInfer<T>) {
  const { _recu, ...propre } = ligne as T & Horodate
  const cle = (propre as Record<string, unknown>)[table.schema.primKey.keyPath as string]
  await db.transaction('rw', table, db.suppressions, async () => {
    await table.put({ ...propre, _modifie: new Date().toISOString() } as T)
    // Ligne recréée après une suppression : la suppression en attente n'a plus lieu d'être
    await db.suppressions.delete(`${table.name}|${cle}`)
  })
  prevenir()
}

/** Supprime une ligne et garde une trace pour la transmettre au serveur. */
export async function supprimer(table: Table<unknown, string>, cle: string) {
  await db.transaction('rw', table, db.suppressions, async () => {
    await table.delete(cle)
    await db.suppressions.put({ id: `${table.name}|${cle}`, table: table.name, cle, _modifie: new Date().toISOString() })
  })
  prevenir()
}

/** À appeler après une écriture groupée (ex. restauration d'une sauvegarde). */
export const signalerEcriture = prevenir
