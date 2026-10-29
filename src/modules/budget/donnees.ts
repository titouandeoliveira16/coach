import type { Table } from 'dexie'
import { useLiveQuery } from 'dexie-react-hooks'
import { aujourdhui, decalerJour } from '../../core/dates'
import { db } from '../../core/db'
import { useReglage } from '../../core/reglages'
import { enregistrer, supprimer } from '../../core/stockage'
import { depensesParCategorie, echeance, moisDe, plafondDe, racine, seuilFranchi, type Donnees } from './calculs'
import { installerCategories } from './categoriesDepart'
import type { Abonnement, Categorie, Compte, EtatAbonnement, Mouvement, Plafond, Releve, TypeCompte } from './types'

/** Toutes les données du module, tenues à jour (undefined pendant le chargement). */
export function useBudget(): Donnees | undefined {
  return useLiveQuery(async () => ({
    comptes: (await db.comptes.toArray()).sort((a, b) => a.ordre - b.ordre),
    mouvements: (await db.mouvements.orderBy('date').reverse().toArray()),
    categories: (await db.categories.toArray()).sort((a, b) => a.ordre - b.ordre),
    plafonds: await db.plafonds.toArray(),
    releves: await db.releves.toArray(),
    ...(await lireAbonnements()),
  }))
}

// ---------- Abonnements (réglage synchronisé « abonnements ») ----------

const CLE_ABONNEMENTS = 'abonnements'
interface ReglageAbonnements { abonnements: Abonnement[]; etatsAbonnements: Record<string, EtatAbonnement> }
async function lireAbonnements(): Promise<ReglageAbonnements> {
  const v = (await db.reglages.get(CLE_ABONNEMENTS))?.valeur as Partial<ReglageAbonnements> | undefined
  return { abonnements: v?.abonnements ?? [], etatsAbonnements: v?.etatsAbonnements ?? {} }
}
const ecrireAbonnements = (v: ReglageAbonnements) => enregistrer(db.reglages, { id: CLE_ABONNEMENTS, valeur: v })

export async function enregistrerAbonnement(a: Abonnement) {
  const v = await lireAbonnements()
  await ecrireAbonnements({ ...v, abonnements: [...v.abonnements.filter((x) => x.id !== a.id), a] })
}

/** Supprimer (résiliation) : plus rien de prévu ; les mouvements déjà enregistrés restent. */
export async function supprimerAbonnement(id: string) {
  const v = await lireAbonnements()
  await ecrireAbonnements({ ...v, abonnements: v.abonnements.filter((x) => x.id !== id) })
}

async function noterEtat(a: Abonnement, mois: string, etat: EtatAbonnement) {
  const v = await lireAbonnements()
  await ecrireAbonnements({ ...v, etatsAbonnements: { ...v.etatsAbonnements, [`${a.id}|${mois}`]: etat } })
}

/** « Oui, c'est passé » (avec le vrai montant si différent) : le mouvement est enregistré à la date d'échéance. */
export async function confirmerAbonnement(a: Abonnement, mois: string, montant = a.montant) {
  const jour = aujourdhui()
  const date = echeance(a, mois) <= jour ? echeance(a, mois) : jour
  await enregistrerMouvement({ id: nouvelId(), type: 'depense', montant, date, compteId: a.compteId, categorieId: a.categorieId, note: a.nom, abonnementId: a.id })
  await noterEtat(a, mois, { statut: 'paye' })
}
/** « Pas ce mois-ci » : rien n'est enregistré, l'abonnement reste pour les mois suivants. */
export const sauterAbonnement = (a: Abonnement, mois: string) => noterEtat(a, mois, { statut: 'saute' })
/** « Pas encore » : redemandé demain. */
export const relancerAbonnement = (a: Abonnement, mois: string) => noterEtat(a, mois, { relance: decalerJour(aujourdhui(), 1) })

// ---------- Réglages du module ----------

export interface ReglagesBudget {
  rappelActif: boolean
  /** "21:00" (par quarts d'heure) */
  rappelHeure: string
  /** Rappel des relevés le 5 du mois (par défaut : oui) */
  rappelReleves?: boolean
  /** Contrôle du solde du compte courant chaque dimanche (par défaut : oui) */
  rappelControle?: boolean
  /** Jour du dernier contrôle du solde fait */
  dernierControle?: string
  /** Dernier bilan mensuel fermé ("2026-10") */
  bilanVu?: string
  /** Mises à jour uniques déjà faites */
  version?: number
}
export const useReglagesBudget = () => useReglage<ReglagesBudget>('budget', { rappelActif: false, rappelHeure: '21:00' })

// ---------- Démarrage ----------

export const COMPTES_DEPART: { id: string; nom: string; type: TypeCompte }[] = [
  { id: 'courant', nom: 'Compte courant', type: 'courant' },
  { id: 'livret-a', nom: 'Livret A', type: 'epargne' },
  { id: 'livret-jeune', nom: 'Livret Jeune', type: 'epargne' },
  { id: 'especes', nom: 'Espèces', type: 'especes' },
  { id: 'bricks', nom: 'Bricks', type: 'investissement' },
  { id: 'compte-titres', nom: 'Compte-titres', type: 'investissement' },
  { id: 'pea', nom: 'PEA', type: 'investissement' },
]

const NOMS_OCTOBRE: Record<string, string> = { pea: 'PEA (Trade Republic)', 'compte-titres': 'CTO (Trade Republic)' }

/** Crée les comptes de départ (avec leurs soldes) et les catégories toutes faites. */
export async function demarrer(soldes: Record<string, number>, jour = aujourdhui(), jourEpargne = jour) {
  for (const [i, c] of COMPTES_DEPART.entries()) {
    const dateDepart = c.type === 'epargne' || c.type === 'investissement' ? jourEpargne : jour
    await enregistrer(db.comptes, { ...c, nom: NOMS_OCTOBRE[c.id] ?? c.nom, soldeInitial: soldes[c.id] ?? 0, dateDepart, ordre: i })
  }
  await installerCategories()
  // Les mises à jour uniques (départ au 1er octobre) ne concernent pas un nouveau départ
  await noterVersion(3)
}

/**
 * Remise à zéro du Budget : comptes, mouvements, relevés et plafonds effacés (sur tous les appareils).
 * Les catégories et le rappel du soir sont gardés. L'écran de départ revient.
 */
export async function remettreAZero() {
  for (const t of [db.mouvements, db.releves, db.plafonds, db.comptes] as Table<{ id: string }, string>[])
    for (const ligne of await t.toArray()) await supprimer(t, ligne.id)
  const { bilanVu: _b, ...reste } = ((await db.reglages.get('budget'))?.valeur ?? {}) as Partial<ReglagesBudget>
  await enregistrer(db.reglages, { id: 'budget', valeur: { rappelActif: false, rappelHeure: '21:00', ...reste, version: 3 } })
}

async function noterVersion(version: number) {
  const actuel = (await db.reglages.get('budget'))?.valeur as object | undefined
  await enregistrer(db.reglages, { id: 'budget', valeur: { rappelActif: false, rappelHeure: '21:00', ...actuel, version } })
}

/**
 * Mises à jour uniques, une fois les comptes créés (numéro gardé dans le réglage « budget ») :
 * catégories choisies ensemble, noms des comptes Trade Republic. Les soldes de départ ne sont jamais dans le code :
 * ils viennent de l'écran de départ ou de l'import de données personnelles (Accueil → ⚙️).
 */
export async function mettreAJour() {
  await alignerDepartsSurReleves()
  const r = (await db.reglages.get('budget'))?.valeur as Partial<ReglagesBudget> | undefined
  if ((r?.version ?? 0) >= 3 || !(await db.comptes.count())) return
  if ((r?.version ?? 0) < 2) {
    await installerCategories()
    for (const [id, nom] of Object.entries(NOMS_OCTOBRE)) {
      const c = await db.comptes.get(id)
      if (c) await enregistrer(db.comptes, { ...c, nom })
    }
  }
  await noterVersion(3)
}

// ---------- Écritures ----------

export const nouvelId = () => crypto.randomUUID()

/**
 * Enregistre un mouvement. Pour une dépense, renvoie l'alerte éventuelle
 * (catégorie qui atteint 90 % ou 100 % de son plafond ce mois-ci).
 */
export async function enregistrerMouvement(m: Mouvement): Promise<string | undefined> {
  const avantTout = await db.mouvements.toArray()
  const categories = await db.categories.toArray()
  const plafonds = await db.plafonds.toArray()
  await enregistrer(db.mouvements, m)
  if (m.type !== 'depense') return
  const mois = moisDe(m.date)
  const cat = racine(m.categorieId, categories)
  if (!cat) return
  const avant = depensesParCategorie(avantTout.filter((x) => x.id !== m.id), categories, mois).get(cat) ?? 0
  const apres = depensesParCategorie([...avantTout.filter((x) => x.id !== m.id), m], categories, mois).get(cat) ?? 0
  const plafond = plafondDe(cat, mois, plafonds)
  const seuil = seuilFranchi(avant, apres, plafond)
  const c = categories.find((x) => x.id === cat)
  if (seuil === 100) return `🔴 ${c?.emoji} ${c?.nom} : plafond du mois atteint`
  if (seuil === 90) return `🟠 ${c?.emoji} ${c?.nom} : 90 % du plafond du mois`
}

export const supprimerMouvement = (id: string) => supprimer(db.mouvements, id)

export const enregistrerCompte = (c: Compte) => enregistrer(db.comptes, c)
export const enregistrerCategorie = (c: Categorie) => enregistrer(db.categories, c)

/** Fixe le plafond d'une catégorie à partir d'un mois (les mois passés gardent le leur). */
export const fixerPlafond = (categorieId: string, mois: string, montant: number | null) =>
  enregistrer(db.plafonds, { id: `${categorieId}|${mois}`, categorieId, mois, montant } satisfies Plafond)

export async function enregistrerReleve(compteId: string, date: string, valeur: number, ajustement?: Pick<Releve, 'ecart' | 'note'>) {
  await enregistrer(db.releves, { id: `${compteId}|${date}`, compteId, date, valeur, ...ajustement } satisfies Releve)
  await alignerDepartsSurReleves()
}

/**
 * Un relevé daté d'avant le départ d'un compte devient son point de départ (date et solde) :
 * sinon il serait ignoré. Ex. comptes démarrés le 1/11 avec des relevés au 1/10 → départ au 1/10.
 * Les relevés suivants (ex. celui du 5/11) prennent ensuite le relais.
 */
export async function alignerDepartsSurReleves() {
  const releves = await db.releves.toArray()
  for (const c of await db.comptes.toArray()) {
    const premier = releves.filter((r) => r.compteId === c.id && r.date < c.dateDepart).sort((a, b) => a.date.localeCompare(b.date))[0]
    if (premier) await enregistrer(db.comptes, { ...c, dateDepart: premier.date, soldeInitial: premier.valeur })
  }
}
export const supprimerReleve = (id: string) => supprimer(db.releves, id)
