import Dexie, { type Table } from 'dexie'
import type { Categorie, Compte, Mouvement, Plafond, Releve } from '../modules/budget/types'
import type { Notion, Rappel, SeanceMemoire, Sujet } from '../modules/revision/types'
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

/** Ce qui a été mangé dans la journée (saisi le soir), ou « pas renseigné ». */
export interface JournalRepas {
  date: string
  kcal?: number
  proteines?: number
  glucides?: number
  lipides?: number
  nonRenseigne?: boolean
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
  comptes!: Table<Compte, string>
  mouvements!: Table<Mouvement, string>
  categories!: Table<Categorie, string>
  plafonds!: Table<Plafond, string>
  releves!: Table<Releve, string>
  repas!: Table<JournalRepas, string>
  notions!: Table<Notion, string>
  revisions!: Table<Rappel, string>
  sujets!: Table<Sujet, string>
  memoire!: Table<SeanceMemoire, string>

  constructor() {
    super('coach')
    this.version(1).stores({ reglages: 'id' })
    // Étape 3 : mesures du matin et pesées, une par jour (la date sert de clé)
    this.version(2).stores({ mesures: 'date', pesees: 'date' })
    // Synchronisation : suppressions en attente d'envoi
    this.version(3).stores({ suppressions: 'id' })
    // Étapes 4 à 11 : séances réalisées et prévues, indisponibilités, décisions du jour
    this.version(4).stores({ seances: 'id, date', prevues: 'id, date', indispos: 'date', decisions: 'date' })
    // Module Budget : comptes, mouvements, catégories, plafonds mensuels, relevés d'investissement
    this.version(5).stores({ comptes: 'id', mouvements: 'id, date', categories: 'id', plafonds: 'id', releves: 'id' })
    // Journal des repas (Entraînement) ; module Révision : notions, rappels, sujets, mémoire
    this.version(6).stores({ repas: 'date', notions: 'id', revisions: 'id, notionId', sujets: 'id', memoire: 'id' })
  }
}

export const db = new BaseCoach()

/**
 * Tables qui contiennent les données de l'utilisateur :
 * ce sont elles qui sont synchronisées, exportées et importées.
 */
export const TABLES_DONNEES = () =>
  [db.reglages, db.mesures, db.pesees, db.seances, db.prevues, db.indispos, db.decisions,
    db.comptes, db.mouvements, db.categories, db.plafonds, db.releves,
    db.repas, db.notions, db.revisions, db.sujets, db.memoire] as Table<object, string>[]

/**
 * Demande à iOS / au navigateur de ne pas effacer nos données
 * en cas de manque de place. Sans effet si déjà accordé.
 */
export function demanderStockagePersistant() {
  navigator.storage?.persist?.().catch(() => {})
}
