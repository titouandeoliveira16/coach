import Dexie, { type Table } from 'dexie'
import type { MesureMatin } from '../modules/entrainement/types'

/** Un réglage = une clé (ex. "profil") et sa valeur (objet libre). */
export interface Reglage {
  id: string
  valeur: unknown
}

/** Une pesée (commune à tous les modules : entraînement, nutrition…). */
export interface Pesee {
  /** Jour de la pesée, "2026-10-26" (une pesée par jour) */
  date: string
  poidsKg: number
}

/**
 * Base de données locale (IndexedDB), partagée par tous les modules.
 *
 * Règle importante : ne jamais modifier une version existante.
 * Pour ajouter une table (séances, repas…), on ajoute une nouvelle version :
 * this.version(N).stores({ ... }). Dexie migre alors les données sans rien perdre.
 */
class BaseCoach extends Dexie {
  reglages!: Table<Reglage, string>
  mesures!: Table<MesureMatin, string>
  pesees!: Table<Pesee, string>

  constructor() {
    super('coach')
    this.version(1).stores({ reglages: 'id' })
    // Étape 3 : mesures du matin et pesées, une par jour (la date sert de clé)
    this.version(2).stores({ mesures: 'date', pesees: 'date' })
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
