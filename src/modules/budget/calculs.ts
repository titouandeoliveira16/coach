import { decalerJour, depuisJour, ecartJours, versJour } from '../../core/dates'
import type { Categorie, Compte, Mouvement, Plafond, Releve } from './types'

/**
 * Calculs du module Budget (fonctions pures, testées). Montants en centimes.
 * Un mois s'écrit "2026-10".
 */

// ---------- Mois ----------

export const moisDe = (jour: string) => jour.slice(0, 7)

export function decalerMois(mois: string, n: number): string {
  const [a, m] = mois.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export const premierJour = (mois: string) => `${mois}-01`
export const dernierJour = (mois: string) => decalerJour(premierJour(decalerMois(mois, 1)), -1)
export const joursDansMois = (mois: string) => Number(dernierJour(mois).slice(8))

/** "2026-10" → "octobre 2026" */
export const nomMois = (mois: string) => depuisJour(premierJour(mois)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
/** "2026-10" → "oct." */
export const moisCourt = (mois: string) => depuisJour(premierJour(mois)).toLocaleDateString('fr-FR', { month: 'short' })

/** Les n derniers mois, du plus ancien au plus récent (le dernier = `jusqua`) */
export const derniersMois = (jusqua: string, n: number) => Array.from({ length: n }, (_, i) => decalerMois(jusqua, i - n + 1))

// ---------- Soldes ----------

/** Effet d'un mouvement sur un compte (centimes signés). */
export function effet(m: Mouvement, compteId: string): number {
  let e = 0
  if (m.compteId === compteId) e += m.type === 'revenu' ? m.montant : -m.montant
  if (m.versCompteId === compteId && (m.type === 'virement' || m.type === 'investissement')) e += m.montant
  return e
}

/**
 * Solde (ou valeur) d'un compte à la fin d'un jour.
 * Point de départ : le dernier relevé à cette date (fin de journée), sinon le solde initial (début du jour de départ) ;
 * on y ajoute les mouvements qui suivent.
 */
export function soldeAu(compte: Compte, mouvements: Mouvement[], releves: Releve[], jour: string): number {
  const releve = releves
    .filter((r) => r.compteId === compte.id && r.date <= jour && r.date >= compte.dateDepart)
    .reduce<Releve | undefined>((d, r) => (!d || r.date > d.date ? r : d), undefined)
  const base = releve ? releve.valeur : compte.soldeInitial
  const apres = (m: Mouvement) => (releve ? m.date > releve.date : m.date >= compte.dateDepart) && m.date <= jour
  return base + mouvements.reduce((s, m) => s + (apres(m) ? effet(m, compte.id) : 0), 0)
}

/** Investissement : argent versé (départ + versements − retraits). */
export function verseAu(compte: Compte, mouvements: Mouvement[], jour: string): number {
  const debut = compte.verseInitial ?? compte.soldeInitial
  return debut + mouvements.reduce((s, m) => s + (m.date >= compte.dateDepart && m.date <= jour ? effet(m, compte.id) : 0), 0)
}

/** Dernier relevé d'un compte (ou undefined). */
export const dernierReleve = (compteId: string, releves: Releve[]) =>
  releves.filter((r) => r.compteId === compteId).sort((a, b) => b.date.localeCompare(a.date))[0]

/** Patrimoine total à la fin d'un jour (comptes déjà ouverts ce jour-là). */
export const patrimoineAu = (comptes: Compte[], mouvements: Mouvement[], releves: Releve[], jour: string) =>
  comptes.filter((c) => c.dateDepart <= jour).reduce((s, c) => s + soldeAu(c, mouvements, releves, jour), 0)

/** Premier jour suivi (départ du plus ancien compte). */
export const debutSuivi = (comptes: Compte[]) =>
  comptes.reduce<string | undefined>((d, c) => (!d || c.dateDepart < d ? c.dateDepart : d), undefined)

// ---------- Catégories ----------

/** Catégorie principale d'une catégorie (elle-même si ce n'en est pas une sous-catégorie). */
export function racine(id: string | undefined, categories: Categorie[]): string | undefined {
  if (!id) return undefined
  return categories.find((c) => c.id === id)?.parentId ?? id
}

/** Catégories principales triées : les plus utilisées ces 90 derniers jours d'abord, puis l'ordre choisi. */
export function categoriesParUsage(categories: Categorie[], mouvements: Mouvement[], genre: Categorie['genre'], jour: string): Categorie[] {
  const depuis = decalerJour(jour, -90)
  const usage = new Map<string, number>()
  for (const m of mouvements) {
    if (m.date < depuis) continue
    const r = racine(m.categorieId, categories)
    if (r) usage.set(r, (usage.get(r) ?? 0) + 1)
  }
  return categories
    .filter((c) => c.genre === genre && !c.parentId && !c.archive)
    .sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.ordre - b.ordre)
}

/** Plafond d'une catégorie pour un mois : le dernier fixé ce mois-ci ou avant. */
export function plafondDe(categorieId: string, mois: string, plafonds: Plafond[]): number | undefined {
  const p = plafonds
    .filter((x) => x.categorieId === categorieId && x.mois <= mois)
    .reduce<Plafond | undefined>((d, x) => (!d || x.mois > d.mois ? x : d), undefined)
  return p?.montant ?? undefined
}

// ---------- Mois ----------

const duMois = (mois: string) => (m: Mouvement) => moisDe(m.date) === mois

/** Dépenses d'un mois par catégorie principale. */
export function depensesParCategorie(mouvements: Mouvement[], categories: Categorie[], mois: string): Map<string, number> {
  const r = new Map<string, number>()
  for (const m of mouvements.filter(duMois(mois))) {
    if (m.type !== 'depense') continue
    const c = racine(m.categorieId, categories) ?? 'sans'
    r.set(c, (r.get(c) ?? 0) + m.montant)
  }
  return r
}

export type CouleurJauge = 'vert' | 'orange' | 'rouge'
/** Vert sous 75 %, orange de 75 à 100 %, rouge au-delà. */
export function couleurJauge(depense: number, plafond: number): CouleurJauge {
  if (depense > plafond) return 'rouge'
  if (depense >= plafond * 0.75) return 'orange'
  return 'vert'
}

/** Seuil d'alerte franchi par une nouvelle dépense (90 % puis 100 % du plafond). */
export function seuilFranchi(avant: number, apres: number, plafond: number | undefined): 90 | 100 | undefined {
  if (!plafond) return undefined
  if (avant < plafond && apres >= plafond) return 100
  if (avant < plafond * 0.9 && apres >= plafond * 0.9) return 90
  return undefined
}

export interface Donnees {
  comptes: Compte[]
  mouvements: Mouvement[]
  categories: Categorie[]
  plafonds: Plafond[]
  releves: Releve[]
}

export interface ResumeMois {
  revenus: number
  depenses: number
  /** Charges fixes encore prévues ce mois-ci (plafond − déjà payé) */
  fixesRestantes: number
  /** Versé sur les comptes d'investissement */
  investi: number
  /** Mis sur les comptes épargne (net des retraits) */
  epargne: number
}

export function resumeMois(d: Donnees, mois: string): ResumeMois {
  const du = d.mouvements.filter(duMois(mois))
  const somme = (f: (m: Mouvement) => boolean) => du.filter(f).reduce((s, m) => s + m.montant, 0)
  const typeDe = (id?: string) => d.comptes.find((c) => c.id === id)?.type
  const revenus = somme((m) => m.type === 'revenu')
  const depenses = somme((m) => m.type === 'depense')
  const investi = somme((m) => m.type === 'investissement')
  const epargne =
    somme((m) => m.type === 'virement' && typeDe(m.versCompteId) === 'epargne' && typeDe(m.compteId) !== 'epargne') -
    somme((m) => m.type === 'virement' && typeDe(m.compteId) === 'epargne' && typeDe(m.versCompteId) !== 'epargne')
  const fixesRestantes = fixesRestantesDuMois(d, mois)
  return { revenus, depenses, fixesRestantes, investi, epargne }
}

/**
 * Reste à vivre (mois en cours) : l'argent disponible aujourd'hui, compte(s) courant(s) + espèces,
 * moins les charges fixes encore à payer ce mois-ci. Part de ce que tu as vraiment, comme ta banque.
 */
export function resteAVivre(d: Donnees, jour: string) {
  const solde = (type: Compte['type']) => d.comptes
    .filter((c) => c.type === type && !c.archive && c.dateDepart <= jour)
    .reduce((s, c) => s + soldeAu(c, d.mouvements, d.releves, jour), 0)
  const courant = solde('courant')
  const especes = solde('especes')
  const fixesRestantes = fixesRestantesDuMois(d, moisDe(jour))
  return { courant, especes, fixesRestantes, reste: courant + especes - fixesRestantes }
}

function fixesRestantesDuMois(d: Donnees, mois: string) {
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois)
  return d.categories
    .filter((c) => c.genre === 'depense' && !c.parentId && c.fixe && !c.archive)
    .reduce((s, c) => s + Math.max(0, (plafondDe(c.id, mois, d.plafonds) ?? 0) - (parCat.get(c.id) ?? 0)), 0)
}

/**
 * Prévision du solde des comptes courants en fin de mois :
 * solde d'aujourd'hui − charges fixes encore prévues − rythme des dépenses variables × jours restants.
 * Rythme = dépenses variables payées depuis un compte courant ce mois-ci ÷ jours écoulés
 * (les 7 premiers jours, s'il existe, le rythme du mois précédent, plus fiable).
 */
export function previsionFinDeMois(d: Donnees, jour: string) {
  const mois = moisDe(jour)
  const courants = d.comptes.filter((c) => c.type === 'courant' && c.dateDepart <= jour)
  const solde = courants.reduce((s, c) => s + soldeAu(c, d.mouvements, d.releves, jour), 0)
  const estCourant = new Set(courants.map((c) => c.id))
  const fixe = (m: Mouvement) => d.categories.find((c) => c.id === racine(m.categorieId, d.categories))?.fixe
  const variables = (m2: string, jusqua: string) =>
    d.mouvements
      .filter((m) => m.type === 'depense' && moisDe(m.date) === m2 && m.date <= jusqua && estCourant.has(m.compteId) && !fixe(m))
      .reduce((s, m) => s + m.montant, 0)

  const ecoules = Number(jour.slice(8))
  const restants = joursDansMois(mois) - ecoules
  let rythme = variables(mois, jour) / ecoules
  const precedent = decalerMois(mois, -1)
  const debut = debutSuivi(courants)
  if (ecoules < 7 && debut && debut <= premierJour(precedent)) rythme = variables(precedent, dernierJour(precedent)) / joursDansMois(precedent)

  const fixesRestantes = fixesRestantesDuMois(d, mois)
  return { solde, fixesRestantes, rythme: Math.round(rythme), restants, prevision: Math.round(solde - fixesRestantes - rythme * restants) }
}

/**
 * Règle 50/30/20 (E. Warren) : besoins, loisirs et épargne (livrets + investissements) d'un mois,
 * en part des revenus du mois. Dépenses sans nature (ex. « À catégoriser ») : à part.
 */
export function repartition503020(d: Donnees, mois: string) {
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois)
  const somme = (nature?: Categorie['nature']) =>
    [...parCat].filter(([id]) => d.categories.find((c) => c.id === id)?.nature === nature).reduce((s, [, v]) => s + v, 0)
  const r = resumeMois(d, mois)
  return { revenus: r.revenus, besoins: somme('besoin'), loisirs: somme('loisir'), autres: somme(undefined), epargne: Math.max(0, r.epargne + r.investi) }
}

// ---------- Bilan mensuel ----------

export interface Bilan {
  mois: string
  resume: ResumeMois
  /** revenus − dépenses */
  solde: number
  hausses: { categorieId: string; ecart: number }[]
  baisses: { categorieId: string; ecart: number }[]
  depassees: { categorieId: string; depense: number; plafond: number }[]
  patrimoineDebut?: number
  patrimoineFin: number
}

export function bilanMois(d: Donnees, mois: string): Bilan {
  const resume = resumeMois(d, mois)
  const ce = depensesParCategorie(d.mouvements, d.categories, mois)
  const avant = depensesParCategorie(d.mouvements, d.categories, decalerMois(mois, -1))
  const ecarts = [...new Set([...ce.keys(), ...avant.keys()])]
    .map((id) => ({ categorieId: id, ecart: (ce.get(id) ?? 0) - (avant.get(id) ?? 0) }))
    .filter((e) => Math.abs(e.ecart) >= 100)
  const depassees = [...ce.entries()]
    .map(([id, depense]) => ({ categorieId: id, depense, plafond: plafondDe(id, mois, d.plafonds) ?? 0 }))
    .filter((x) => x.plafond > 0 && x.depense > x.plafond)
  const finPrecedent = dernierJour(decalerMois(mois, -1))
  const debut = debutSuivi(d.comptes)
  return {
    mois,
    resume,
    solde: resume.revenus - resume.depenses,
    hausses: ecarts.filter((e) => e.ecart > 0).sort((a, b) => b.ecart - a.ecart).slice(0, 3),
    baisses: ecarts.filter((e) => e.ecart < 0).sort((a, b) => a.ecart - b.ecart).slice(0, 3),
    depassees,
    patrimoineDebut: debut && debut <= finPrecedent ? patrimoineAu(d.comptes, d.mouvements, d.releves, finPrecedent) : undefined,
    patrimoineFin: patrimoineAu(d.comptes, d.mouvements, d.releves, dernierJour(mois)),
  }
}

/** Patrimoine en fin de chaque mois (au jour donné pour le mois en cours), undefined avant le début du suivi. */
export function patrimoineParMois(d: Donnees, mois: string[], jour: string): (number | undefined)[] {
  const debut = debutSuivi(d.comptes)
  return mois.map((m) => {
    const fin = dernierJour(m) < jour ? dernierJour(m) : jour
    return debut && debut <= fin ? patrimoineAu(d.comptes, d.mouvements, d.releves, fin) : undefined
  })
}

/** Nombre de jours depuis le dernier relevé (undefined s'il n'y en a pas). */
export const ageReleve = (compteId: string, releves: Releve[], jour: string) => {
  const r = dernierReleve(compteId, releves)
  return r ? ecartJours(r.date, jour) : undefined
}

export const aujourdhuiMois = () => moisDe(versJour(new Date()))

/**
 * Contrôle du solde du compte courant, chaque dimanche : à faire si le dernier contrôle
 * date d'avant le dernier dimanche (la carte reste jusqu'à ce qu'il soit fait).
 */
export function controleAFaire(dernierControle: string | undefined, jour: string) {
  const d = new Date(`${jour}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  const dimanche = d.toISOString().slice(0, 10)
  return !dernierControle || dernierControle < dimanche
}
