import Dexie, { type Table } from 'dexie'
import type { Decision, Indispo, MesureMatin, Seance, SeancePrevue } from '../modules/entrainement/types'

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

/** Trace d'une ligne supprimée, à transmettre au serveur lors de la prochaine synchro. */
export interface Suppression {
  /** "table|clé", ex. "mesures|2026-10-23" */
  id: string
  table: string
  cle: string
  _modifie: string
}

/**
 * Base de données locale (IndexedDB), partagée par tous les modules.
 * L'appli lit et écrit toujours ici (elle marche donc hors ligne) ;
 * la synchronisation avec le serveur se fait ensuite (voir synchro.ts).
 *
 * Règle importante : ne jamais modifier une version existante.
 * Pour ajouter une table (séances, repas…), on ajoute une nouvelle version :
 * this.version(N).stores({ ... }). Dexie migre alors les données sans rien perdre.
 * Une nouvelle table de données doit aussi être ajoutée à TABLES_DONNEES.
 */
class BaseCoach extends Dexie {
  reglages!: Table<Reglage, string>
  mesures!: Table<MesureMatin, string>
  pesees!: Table<Pesee, string>
  suppressions!: Table<Suppression, string>
  seances!: Table<Seance, string>
  prevues!: Table<SeancePrevue, string>
  indispos!: Table<Indispo, string>
  decisions!: Table<Decision, string>

  constructor() {
    super('coach')
    this.version(1).stores({ reglages: 'id' })
    // Étape 3 : mesures du matin et pesées, une par jour (la date sert de clé)
    this.version(2).stores({ mesures: 'date', pesees: 'date' })
    // Synchronisation : suppressions en attente d'envoi
    this.version(3).stores({ suppressions: 'id' })
    // Étapes 4 à 11 : séances réalisées et prévues, indisponibilités, décisions du jour
    this.version(4).stores({ seances: 'id, date', prevues: 'id, date', indispos: 'date', decisions: 'date' })
  }
}

export const db = new BaseCoach()

/**
 * Tables qui contiennent les données de l'utilisateur :
 * ce sont elles qui sont synchronisées, exportées et importées.
 */
export const TABLES_DONNEES = () =>
  [db.reglages, db.mesures, db.pesees, db.seances, db.prevues, db.indispos, db.decisions] as Table<object, string>[]

/**
 * Demande à iOS / au navigateur de ne pas effacer nos données
 * en cas de manque de place. Sans effet si déjà accordé.
 */
export function demanderStockagePersistant() {
  navigator.storage?.persist?.().catch(() => {})
}
