/** Données du module Révision CAPEPS. Les jours s'écrivent "2026-10-26". */

export type Epreuve = 'E1' | 'E2'
export type Theme = 'T1' | 'T2' | 'T3' | 'Théorie' | 'Blocs'

export interface Notion {
  id: string
  nom: string
  epreuve: Epreuve
  theme: Theme
  ordre: number
  statut: 'a-faire' | 'en-cours' | 'finie'
  /** Jour où la notion a été finie (J0 réel) */
  j0?: string
  /** 1 fragile · 2 moyen · 3 solide (d'après le dernier rappel, modifiable) */
  niveau?: 1 | 2 | 3
  /** Feuille blanche de fixation faite (l'après-midi du J0) */
  fixation?: boolean
}

export type Resultat = 'su' | 'hesitant' | 'rate'

/** Un rappel en feuille blanche (méthode des J). */
export interface Rappel {
  id: string
  notionId: string
  /** 1, 4, 10, 21, 45, 90 (jours après le J0) */
  intervalle: number
  /** Jour prévu */
  prevu: string
  /** Rappel en plus : après un « hésitant » ou une notion faible dans un sujet */
  cible?: 'hesitant' | 'sujet'
  /** Jour où il a été fait */
  fait?: string
  resultat?: Resultat
  /** Annulé (la notion est repartie de zéro après un raté) */
  annule?: boolean
}

export interface Sujet {
  id: string
  date: string
  epreuve: Epreuve
  type: 'complet' | 'express'
  intitule?: string
  dureeMin?: number
  note?: number
  /** Notions faibles : elles reçoivent un rappel ciblé le lendemain */
  notionsFaibles: string[]
  remarques?: string
}

/** Demi-journée de mémoire de recherche. */
export interface SeanceMemoire {
  /** Le jour */
  id: string
  objectif?: string
  fait?: boolean
}
