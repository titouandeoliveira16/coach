import Dexie, { type Table } from 'dexie'

/** Un réglage = une clé (ex. "profil") et sa valeur (objet libre). */
export interface Reglage {
  id: string
  valeur: unknown
}

/**
 * Base de données locale (IndexedDB), partagée par tous les modules.
 *
 * Règle importante : ne jamais modifier une version existante.
 * Pour ajouter une table (séances, mesures du matin, repas…),
 * on ajoute une nouvelle version : this.version(2).stores({ ... }).
 * Dexie migre alors les données existantes sans rien perdre.
 */
class BaseCoach extends Dexie {
  reglages!: Table<Reglage, string>

  constructor() {
    super('coach')
    this.version(1).stores({ reglages: 'id' })
  }
}

export const db = new BaseCoach()

/**
 * Demande à iOS / au navigateur de ne pas effacer nos données
 * en cas de manque de place. Sans effet si déjà accordé.
 */
export function demanderStockagePersistant() {
  navigator.storage?.persist?.().catch(() => {})
}
