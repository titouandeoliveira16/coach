import { aujourdhui } from '../../core/dates'
import { db } from '../../core/db'
import { enregistrer } from '../../core/stockage'
import { soldeAu } from './calculs'
import type { Mouvement, TypeMouvement } from './types'

/**
 * Import de mouvements depuis un fichier (JSON) gardé sur le téléphone : sert à rattraper un mois passé
 * sans rien écrire dans le code de l'appli (le dépôt GitHub est public).
 * Montants en euros dans le fichier ; « soldes » règle le solde actuel de certains comptes.
 */
export interface FichierImport {
  mouvements: {
    id?: string
    type: TypeMouvement
    montant: number
    date: string
    compte?: string
    vers?: string
    categorie?: string
    note?: string
  }[]
  /** Solde actuel à régler, par compte (euros) */
  soldes?: Record<string, number>
}

const TYPES: TypeMouvement[] = ['depense', 'revenu', 'virement', 'investissement']

/** Lit et vérifie le fichier. Lève une erreur claire si quelque chose ne va pas. */
export function lireImport(texte: string): FichierImport {
  let f: FichierImport
  try {
    f = JSON.parse(texte)
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un fichier d’import du Budget.')
  }
  if (!Array.isArray(f?.mouvements)) throw new Error('Aucun mouvement dans ce fichier.')
  f.mouvements.forEach((m, i) => {
    if (!TYPES.includes(m.type) || !(m.montant > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(m.date))
      throw new Error(`Ligne ${i + 1} incorrecte (type, montant ou date).`)
  })
  return f
}

/** Identifiant stable : réimporter le même fichier n'ajoute rien en double. */
const idDe = (m: FichierImport['mouvements'][number]) =>
  m.id ?? `import-${m.date}-${m.type}-${m.categorie ?? m.vers ?? ''}-${Math.round(m.montant * 100)}-${m.note ?? ''}`

export async function importer(f: FichierImport) {
  const categories = new Set((await db.categories.toArray()).map((c) => c.id))
  const comptes = new Set((await db.comptes.toArray()).map((c) => c.id))
  let ajoutes = 0
  for (const m of f.mouvements) {
    const id = idDe(m)
    if (await db.mouvements.get(id)) continue
    const compteId = m.compte && comptes.has(m.compte) ? m.compte : 'courant'
    const mouvement: Mouvement = {
      id, type: m.type, montant: Math.round(m.montant * 100), date: m.date, compteId,
      ...(m.type === 'depense' || m.type === 'revenu'
        ? { categorieId: m.categorie && categories.has(m.categorie) ? m.categorie : m.type === 'revenu' ? 'autre-revenu' : 'divers' }
        : { versCompteId: m.vers }),
      ...(m.note ? { note: m.note } : {}),
    }
    await enregistrer(db.mouvements, mouvement)
    ajoutes++
  }
  // Soldes du jour : le solde de départ est recalé pour tomber juste aujourd'hui
  const [mouvements, releves] = [await db.mouvements.toArray(), await db.releves.toArray()]
  for (const [id, euros] of Object.entries(f.soldes ?? {})) {
    const c = await db.comptes.get(id)
    if (!c) continue
    const actuel = soldeAu(c, mouvements, releves, aujourdhui())
    await enregistrer(db.comptes, { ...c, soldeInitial: c.soldeInitial + Math.round(euros * 100) - actuel })
  }
  return { ajoutes, deja: f.mouvements.length - ajoutes }
}

/** Résumé avant import : nombre de lignes, dépenses et revenus. */
export function resumeImport(f: FichierImport) {
  const somme = (t: TypeMouvement) => f.mouvements.filter((m) => m.type === t).reduce((a, m) => a + Math.round(m.montant * 100), 0)
  return { lignes: f.mouvements.length, depenses: somme('depense'), revenus: somme('revenu') }
}
