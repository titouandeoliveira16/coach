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
  /** Mouvement créé en confirmant un abonnement */
  abonnementId?: string
}

/** Abonnement qui revient chaque mois (Spotify, téléphone…), confirmé à la main le jour où il passe. */
export interface Abonnement {
  id: string
  nom: string
  /** Centimes */
  montant: number
  categorieId: string
  compteId: string
  /** Jour du mois du prélèvement (1-31 ; ramené au dernier jour pour les mois courts) */
  jour: number
  actif: boolean
  /** Jour de création : pas d'échéance avant */
  depuis: string
}

/** État d'un abonnement pour un mois, clé "abonnementId|2026-11" : payé, sauté, ou à redemander à partir d'un jour. */
export interface EtatAbonnement {
  statut?: 'paye' | 'saute'
  relance?: string
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
  /** Compte courant : ajustement après le contrôle du solde (écart en centimes = banque − appli) et sa justification */
  ecart?: number
  note?: string
}
