import { aujourdhui } from '../../core/dates'
import { db } from '../../core/db'
import { enregistrer } from '../../core/stockage'
import { dernierReleve, soldeAu } from './calculs'
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
    /** Revenu : catégorie de dépense remboursée (le revenu devient un « Remboursement » qui vient en moins de cette dépense) */
    rembourse?: string
  }[]
  /** Solde actuel à régler, par compte (euros) */
  soldes?: Record<string, number>
}

const TYPES: TypeMouvement[] = ['depense', 'revenu', 'virement', 'investissement']
const MONTANT_MAX = 1_000_000

/** Vraie date du calendrier ("2026-02-30" refusé). */
const dateValide = (t: unknown) => {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const d = new Date(`${t}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t
}
const texteOuRien = (t: unknown) => t === undefined || typeof t === 'string'

/** Lit et vérifie tout le fichier avant d'écrire quoi que ce soit. Lève une erreur claire si quelque chose ne va pas. */
export function lireImport(texte: string): FichierImport {
  let f: FichierImport
  try {
    f = JSON.parse(texte)
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un fichier d’import du Budget.')
  }
  if (!Array.isArray(f?.mouvements)) throw new Error('Aucun mouvement dans ce fichier.')
  f.mouvements.forEach((m, i) => {
    const ligne = `Ligne ${i + 1} incorrecte`
    if (!m || typeof m !== 'object') throw new Error(`${ligne}.`)
    if (!TYPES.includes(m.type)) throw new Error(`${ligne} : type inconnu.`)
    if (typeof m.montant !== 'number' || !Number.isFinite(m.montant) || m.montant <= 0 || m.montant > MONTANT_MAX) throw new Error(`${ligne} : montant.`)
    if (!dateValide(m.date)) throw new Error(`${ligne} : date.`)
    if (![m.id, m.compte, m.vers, m.categorie, m.note, m.rembourse].every(texteOuRien)) throw new Error(`${ligne} : texte attendu.`)
    if ((m.type === 'virement' || m.type === 'investissement') && !m.vers) throw new Error(`${ligne} : compte d’arrivée (« vers ») manquant.`)
  })
  if (f.soldes !== undefined && (typeof f.soldes !== 'object' || Object.values(f.soldes).some((v) => typeof v !== 'number' || !Number.isFinite(v))))
    throw new Error('Soldes incorrects : un nombre par compte.')
  return f
}

/** Empreinte courte d'un texte (FNV-1a) : identifiants courts même avec une longue note. */
const empreinte = (t: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

/**
 * Identifiants stables : réimporter le même fichier n'ajoute rien en double. Deux lignes identiques du fichier
 * (deux cafés le même jour) gardent chacune la leur (-2, -3…). Toujours moins de 200 caractères (limite du serveur).
 */
function identifiants(f: FichierImport): string[] {
  const vus = new Map<string, number>()
  return f.mouvements.map((m) => {
    if (m.id) return m.id.slice(0, 190)
    let id = `import-${m.date}-${m.type}-${m.categorie ?? m.vers ?? ''}-${Math.round(m.montant * 100)}-${m.note ?? ''}`
    if (id.length > 150) id = `import-${m.date}-${m.type}-${Math.round(m.montant * 100)}-${empreinte(id)}`
    const n = (vus.get(id) ?? 0) + 1
    vus.set(id, n)
    return n > 1 ? `${id}-${n}` : id
  })
}

/** Lignes du fichier qui ressemblent à un mouvement déjà là (même jour, même type, même montant) mais pas importé : saisi à la main ? */
export async function ressemblants(f: FichierImport) {
  const ids = identifiants(f)
  const existants = await db.mouvements.toArray()
  let n = 0
  for (const [i, m] of f.mouvements.entries()) {
    if (await db.mouvements.get(ids[i])) continue
    if (existants.some((x) => x.date === m.date && x.type === m.type && x.montant === Math.round(m.montant * 100))) n++
  }
  return n
}

export async function importer(f: FichierImport) {
  const categories = new Set((await db.categories.toArray()).map((c) => c.id))
  const comptes = new Set((await db.comptes.toArray()).map((c) => c.id))
  // Tout est vérifié avant la première écriture : pas d'import à moitié fait
  f.mouvements.forEach((m, i) => {
    if (m.compte && !comptes.has(m.compte)) throw new Error(`Ligne ${i + 1} : compte « ${m.compte} » inconnu.`)
    if (m.vers && !comptes.has(m.vers)) throw new Error(`Ligne ${i + 1} : compte d’arrivée « ${m.vers} » inconnu.`)
  })
  const ids = identifiants(f)
  let ajoutes = 0
  for (const [i, m] of f.mouvements.entries()) {
    const id = ids[i]
    if (await db.mouvements.get(id)) continue
    const compteId = m.compte ?? 'courant'
    const mouvement: Mouvement = {
      id, type: m.type, montant: Math.round(m.montant * 100), date: m.date, compteId,
      ...(m.type === 'depense' || m.type === 'revenu'
        ? { categorieId: m.categorie && categories.has(m.categorie) ? m.categorie : m.type === 'revenu' ? 'autre-revenu' : 'divers' }
        : { versCompteId: m.vers }),
      ...(m.type === 'revenu' && m.rembourse && categories.has(m.rembourse) ? { categorieId: 'remboursement', rembourse: m.rembourse } : {}),
      ...(m.note ? { note: m.note.slice(0, 500) } : {}),
    }
    await enregistrer(db.mouvements, mouvement)
    ajoutes++
  }
  // Soldes du jour : le dernier relevé du compte (s'il y en a un) ou son solde de départ est recalé pour tomber juste aujourd'hui
  const [mouvements, releves] = [await db.mouvements.toArray(), await db.releves.toArray()]
  for (const [id, euros] of Object.entries(f.soldes ?? {})) {
    const c = await db.comptes.get(id)
    if (!c) continue
    const ecart = Math.round(euros * 100) - soldeAu(c, mouvements, releves, aujourdhui())
    const releve = dernierReleve(c.id, releves.filter((r) => r.date <= aujourdhui() && r.date >= c.dateDepart))
    if (releve) await enregistrer(db.releves, { ...releve, valeur: releve.valeur + ecart })
    else await enregistrer(db.comptes, { ...c, soldeInitial: c.soldeInitial + ecart })
  }
  return { ajoutes, deja: f.mouvements.length - ajoutes }
}

/** Résumé avant import : nombre de lignes, dépenses et revenus. */
export function resumeImport(f: FichierImport) {
  const somme = (t: TypeMouvement) => f.mouvements.filter((m) => m.type === t).reduce((a, m) => a + Math.round(m.montant * 100), 0)
  return { lignes: f.mouvements.length, depenses: somme('depense'), revenus: somme('revenu') }
}
