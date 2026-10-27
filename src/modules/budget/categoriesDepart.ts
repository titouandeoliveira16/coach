import { db } from '../../core/db'
import { enregistrer, supprimer } from '../../core/stockage'
import type { Categorie } from './types'

/** Couleurs proposées pour les catégories (lisibles sur fond sombre). */
export const COULEURS = ['#60a5fa', '#4ade80', '#fb923c', '#facc15', '#e879f9', '#f87171', '#818cf8', '#f472b6', '#2dd4bf', '#a3e635', '#94a3b8', '#38bdf8', '#fbbf24']

interface Modele {
  id: string
  nom: string
  emoji: string
  nature?: Categorie['nature']
  /** Sous-catégories : [id, nom] */
  sous?: [string, string][]
}

/** Catégories choisies avec Titouan le 26/10/2026 (toutes variables ; besoin ou loisir pour la règle 50/30/20). */
export const DEPENSES: Modele[] = [
  { id: 'courses', nom: 'Courses', emoji: '🛒', nature: 'besoin' },
  { id: 'transport', nom: 'Voiture & transport', emoji: '🚗', nature: 'besoin', sous: [['carburant', 'Carburant'], ['peage', 'Péage / transport'], ['entretien', 'Entretien']] },
  { id: 'maison', nom: 'Maison', emoji: '🏠', nature: 'besoin', sous: [['energie', 'Énergie'], ['internet', 'Internet'], ['equipement', 'Équipement']] },
  { id: 'abonnements', nom: 'Abonnements', emoji: '📱', nature: 'besoin', sous: [['basic-fit', 'Basic-Fit'], ['telephone', 'Téléphone'], ['apple', 'Apple'], ['spotify', 'Spotify'], ['coaching', 'Coaching']] },
  { id: 'sante', nom: 'Santé & soins', emoji: '💊', nature: 'besoin', sous: [['sante', 'Santé'], ['coiffeur', 'Coiffeur / soins']] },
  { id: 'banque', nom: 'Banque & administratif', emoji: '🏦', nature: 'besoin', sous: [['frais', 'Frais bancaires'], ['administratif', 'Administratif']] },
  { id: 'animaux', nom: 'Animaux', emoji: '🐾', nature: 'besoin' },
  { id: 'sorties', nom: 'Restos & sorties', emoji: '🍽️', nature: 'loisir', sous: [['restaurant', 'Restaurant'], ['sortie', 'Sortie'], ['cinema', 'Cinéma']] },
  { id: 'shopping', nom: 'Shopping', emoji: '👕', nature: 'loisir', sous: [['vetements', 'Vêtements'], ['livres', 'Livres']] },
  { id: 'sport', nom: 'Sport', emoji: '🚴', nature: 'loisir' },
  { id: 'vacances', nom: 'Vacances & voyages', emoji: '✈️', nature: 'loisir' },
  { id: 'cadeaux', nom: 'Cadeaux & proches', emoji: '🎁', nature: 'loisir', sous: [['cadeaux', 'Cadeaux'], ['proche', 'Virement à un proche']] },
  { id: 'divers', nom: 'À catégoriser', emoji: '📦' },
]

export const REVENUS: Modele[] = [
  { id: 'salaire-aed', nom: 'Salaire', emoji: '💼' },
  { id: 'bourse', nom: 'Bourse', emoji: '🎓' },
  { id: 'stage', nom: 'Stage', emoji: '🧑‍💼' },
  { id: 'intermarche', nom: 'Job étudiant', emoji: '🧑‍🍳' },
  { id: 'remboursement', nom: 'Remboursement', emoji: '↩️' },
  { id: 'cadeau-recu', nom: "Reçu d'un proche", emoji: '🤝' },
  { id: 'autre-revenu', nom: 'Autre', emoji: '➕' },
]

/** Anciennes catégories toutes faites (v0.27.0) → remplaçante. Elles sont archivées, leurs mouvements déplacés. */
const REMPLACEES: Record<string, string> = { logement: 'maison', etudes: 'divers', job: 'autre-revenu', aides: 'autre-revenu' }

/**
 * Installe (ou met à jour) les catégories ci-dessus. Les couleurs déjà choisies sont gardées.
 * Sans danger si relancé : mêmes identifiants, mêmes valeurs.
 */
export async function installerCategories() {
  const existantes = new Map((await db.categories.toArray()).map((c) => [c.id, c]))
  const ecrire = async (c: Categorie) => {
    const { fixe: _fixe, archive: _archive, parentId: _parentId, nature: _nature, ...avant } = existantes.get(c.id) ?? ({} as Partial<Categorie>)
    await enregistrer(db.categories, { ...avant, ...c, couleur: avant.couleur ?? c.couleur })
  }
  for (const [genre, liste] of [['depense', DEPENSES], ['revenu', REVENUS]] as const) {
    for (const [i, m] of liste.entries()) {
      const couleur = genre === 'revenu' ? '#4ade80' : COULEURS[i % COULEURS.length]
      await ecrire({ id: m.id, nom: m.nom, emoji: m.emoji, couleur, genre, ordre: i, ...(m.nature ? { nature: m.nature } : {}) })
      for (const [j, [id, nom]] of (m.sous ?? []).entries())
        await ecrire({ id: `${m.id}-${id}`, nom, emoji: m.emoji, couleur, genre, parentId: m.id, ordre: j })
    }
  }
  for (const [ancienne, nouvelle] of Object.entries(REMPLACEES)) {
    const c = existantes.get(ancienne)
    if (c && !c.archive) await enregistrer(db.categories, { ...c, archive: true })
    for (const m of await db.mouvements.toArray()) if (m.categorieId === ancienne) await enregistrer(db.mouvements, { ...m, categorieId: nouvelle })
    for (const p of await db.plafonds.toArray()) if (p.categorieId === ancienne) await supprimer(db.plafonds, p.id)
  }
}
