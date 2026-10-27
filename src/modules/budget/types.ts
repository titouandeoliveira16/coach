/** Données du module Budget. Tous les montants sont en centimes (entiers) : pas d'erreurs d'arrondi. */

export type TypeCompte = 'courant' | 'epargne' | 'especes' | 'investissement'

export interface Compte {
  id: string
  nom: string
  type: TypeCompte
  /** Solde au début du jour de départ (centimes) */
  soldeInitial: number
  /** Investissement : argent versé au départ (centimes). Par défaut = solde initial */
  verseInitial?: number
  /** Jour de départ "2026-10-26" */
  dateDepart: string
  archive?: boolean
  ordre: number
}

export type TypeMouvement = 'depense' | 'revenu' | 'virement' | 'investissement'

export interface Mouvement {
  id: string
  type: TypeMouvement
  /** Montant positif (centimes) */
  montant: number
  date: string
  /** Dépense, virement, investissement : compte débité. Revenu : compte crédité. */
  compteId: string
  /** Virement, investissement : compte crédité */
  versCompteId?: string
  /** Dépense : catégorie ou sous-catégorie. Revenu : catégorie de revenu. */
  categorieId?: string
  note?: string
}

export interface Categorie {
  id: string
  nom: string
  emoji: string
  couleur: string
  genre: 'depense' | 'revenu'
  /** Sous-catégorie de… (un seul niveau) */
  parentId?: string
  /** Charge fixe (loyer, abonnements…) */
  fixe?: boolean
  /** Dépense : besoin ou loisir (répartition 50/30/20) */
  nature?: 'besoin' | 'loisir'
  archive?: boolean
  ordre: number
}

/** Plafond d'une catégorie à partir d'un mois (vaut aussi pour les mois suivants, jusqu'au prochain changement). */
export interface Plafond {
  /** "categorieId|2026-10" */
  id: string
  categorieId: string
  mois: string
  /** Centimes ; null = plus de plafond à partir de ce mois */
  montant: number | null
}

/** Relevé d'un compte d'investissement : « au JJ/MM, il vaut X € ». */
export interface Releve {
  /** "compteId|2026-10-26" */
  id: string
  compteId: string
  date: string
  valeur: number
}
