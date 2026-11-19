import { decalerJour, depuisJour, ecartJours, versJour } from '../../core/dates'
import type { Abonnement, Categorie, Compte, EtatAbonnement, Mouvement, Plafond, Releve } from './types'

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

/** Remboursement rattaché à une catégorie de dépense : il vient en moins de cette dépense (pas un revenu). */
export const estRemboursement = (m: Mouvement) => m.type === 'revenu' && !!m.rembourse

/**
 * Dépenses nettes d'un mois par catégorie (principale, ou la catégorie exacte avec `exacte`) :
 * dépenses − remboursements rattachés (jamais en dessous de 0 pour une catégorie).
 */
export function depensesParCategorie(mouvements: Mouvement[], categories: Categorie[], mois: string, exacte = false): Map<string, number> {
  const cle = (id?: string) => (exacte ? id : racine(id, categories)) ?? 'sans'
  // Audit du 18/11/2026 : un remboursement compte pour le mois de la dépense remboursée (choisi à la saisie)
  const brut = (m0: string) => {
    const r = new Map<string, number>()
    for (const m of mouvements) {
      if (m.type === 'depense' && moisDe(m.date) === m0) r.set(cle(m.categorieId), (r.get(cle(m.categorieId)) ?? 0) + m.montant)
      else if (estRemboursement(m) && (m.rembourseMois ?? moisDe(m.date)) === m0) r.set(cle(m.rembourse), (r.get(cle(m.rembourse)) ?? 0) - m.montant)
    }
    return r
  }
  const r = brut(mois)
  // Remboursement plus grand que les dépenses de son mois (sans mois choisi) : le reste vient en moins du mois d'avant,
  // au lieu de disparaître
  for (const [k, v] of brut(decalerMois(mois, 1))) if (v < 0) r.set(k, (r.get(k) ?? 0) + v)
  for (const [k, v] of r) if (v <= 0) r.delete(k)
  return r
}

export type CouleurJauge = 'vert' | 'orange' | 'rouge'
/** Vert sous 75 %, orange de 75 à 110 %, rouge au-delà de 110 % (un petit dépassement n'est pas une alerte). */
export function couleurJauge(depense: number, plafond: number): CouleurJauge {
  if (depense > plafond * 1.1) return 'rouge'
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
  abonnements?: Abonnement[]
  etatsAbonnements?: Record<string, EtatAbonnement>
}

// ---------- Abonnements ----------

/** Jour d'échéance d'un abonnement pour un mois ("2026-11-05"), ramené au dernier jour pour les mois courts. */
export const echeance = (a: Abonnement, mois: string) => `${mois}-${String(Math.min(a.jour, joursDansMois(mois))).padStart(2, '0')}`

/**
 * Échéance déjà réglée sans passer par la carte : un mouvement de cet abonnement ce mois-là, ou un mouvement
 * saisi à la main dans la même catégorie (principale) pour un montant proche (± 10 %).
 */
export function dejaSaisi(a: Abonnement, mois: string, d: Pick<Donnees, 'mouvements' | 'categories'>) {
  const cat = racine(a.categorieId, d.categories)
  return d.mouvements.some((m) => moisDe(m.date) === mois && (m.type === 'depense' || m.type === 'revenu')
    && (m.abonnementId === a.id || (!m.abonnementId && racine(m.categorieId, d.categories) === cat && Math.abs(m.montant - a.montant) <= a.montant * 0.1)))
}

/** Abonnements du mois de `jour` pas encore payés ni sautés (y compris ceux en retard) : comptés d'avance. */
export function abonnementsAVenir(d: Donnees, jour: string) {
  const mois = moisDe(jour)
  return (d.abonnements ?? []).filter((a) => a.actif && echeance(a, mois) >= a.depuis && !d.etatsAbonnements?.[`${a.id}|${mois}`]?.statut && !dejaSaisi(a, mois, d))
}

/** Échéances du mois précédent jamais traitées (ni payées, ni sautées, ni saisies) : on les redemande. */
export function abonnementsEnRetard(d: Donnees, jour: string) {
  const mois = decalerMois(moisDe(jour), -1)
  return (d.abonnements ?? []).filter((a) => a.actif && echeance(a, mois) >= a.depuis && !d.etatsAbonnements?.[`${a.id}|${mois}`]?.statut && !dejaSaisi(a, mois, d))
}

/** Abonnements à faire confirmer aujourd'hui (avec leur mois) : échéance passée, pas encore traités, pas remis à plus tard. */
export function abonnementsAVerifier(d: Donnees, jour: string): { a: Abonnement; mois: string }[] {
  const mois = moisDe(jour)
  const pret = (a: Abonnement, m: string) => {
    const relance = d.etatsAbonnements?.[`${a.id}|${m}`]?.relance
    return echeance(a, m) <= jour && (!relance || relance <= jour)
  }
  const precedent = decalerMois(mois, -1)
  return [
    ...abonnementsEnRetard(d, jour).filter((a) => pret(a, precedent)).map((a) => ({ a, mois: precedent })),
    ...abonnementsAVenir(d, jour).filter((a) => pret(a, mois)).map((a) => ({ a, mois })),
  ]
}

const sommeAbonnements = (l: Abonnement[]) => l.reduce((s, a) => s + a.montant, 0)

/**
 * Revenu de fin de mois : à partir du 25, un revenu sert à vivre le mois suivant (ex. salaire versé le 30).
 * Il compte alors pour le mois suivant dans les bilans (revenus, 50/30/20) ; le solde du compte, lui, ne change pas.
 * Un remboursement n'est pas un revenu : il n'est pas concerné.
 */
export const JOUR_REVENU_MOIS_SUIVANT = 25
export const moisDuRevenu = (date: string) => (Number(date.slice(8)) >= JOUR_REVENU_MOIS_SUIVANT ? decalerMois(moisDe(date), 1) : moisDe(date))

/** Abonnement de revenu (catégorie de revenu) : un revenu régulier attendu (salaire, bourse…). */
export const estRevenuAttendu = (a: Abonnement, d: Pick<Donnees, 'categories'>) => d.categories.find((c) => c.id === a.categorieId)?.genre === 'revenu'

/**
 * À venir ce mois-ci (pas encore confirmés) : dépenses régulières (abonnements, y compris celles du mois précédent
 * jamais confirmées) et revenus réguliers attendus. Les revenus attendus à partir du 25 servent au mois suivant : pas comptés ici.
 */
export function aVenir(d: Donnees, jour: string) {
  const l = abonnementsAVenir(d, jour)
  const revenus = l.filter((a) => estRevenuAttendu(a, d) && a.jour < JOUR_REVENU_MOIS_SUIVANT)
  const depenses = [...abonnementsEnRetard(d, jour), ...l].filter((a) => !estRevenuAttendu(a, d))
  return { depenses, revenus }
}

/**
 * Charges fixes encore à payer ce mois-ci, catégorie par catégorie :
 * plafond − déjà payé − abonnements de la catégorie encore à venir (comptés à part).
 */
export function detailFixesRestantes(d: Donnees, mois: string) {
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois)
  const abonnes = abonnementsAVenir(d, premierJour(mois)).filter((a) => !estRevenuAttendu(a, d))
  return d.categories
    .filter((c) => c.genre === 'depense' && !c.parentId && c.fixe && !c.archive)
    .map((c) => {
      const aVenirCat = sommeAbonnements(abonnes.filter((a) => racine(a.categorieId, d.categories) === c.id))
      return { categorie: c, montant: Math.max(0, (plafondDe(c.id, mois, d.plafonds) ?? 0) - (parCat.get(c.id) ?? 0) - aVenirCat) }
    })
    .filter((x) => x.montant > 0)
}

export interface ResumeMois {
  /** Revenus qui servent à ce mois (remboursements exclus : ils viennent en moins des dépenses) */
  revenus: number
  /** Dépenses nettes des remboursements */
  depenses: number
  /** Charges fixes encore prévues ce mois-ci (plafond − déjà payé) */
  fixesRestantes: number
  /** Versé sur les comptes d'investissement (investissements et virements vers un placement) */
  investi: number
  /** Mis de côté : revenus − dépenses (un passage du livret au PEA n'est pas de l'épargne nouvelle) */
  epargne: number
}

export function resumeMois(d: Donnees, mois: string): ResumeMois {
  const du = d.mouvements.filter(duMois(mois))
  const typeDe = (id?: string) => d.comptes.find((c) => c.id === id)?.type
  // Revenus : ceux qui servent à ce mois (un salaire du 30 compte pour le mois suivant)
  const revenus = d.mouvements.filter((m) => m.type === 'revenu' && !estRemboursement(m) && moisDuRevenu(m.date) === mois).reduce((s, m) => s + m.montant, 0)
  const depenses = [...depensesParCategorie(d.mouvements, d.categories, mois).values()].reduce((s, v) => s + v, 0)
  const investi = du.reduce((s, m) => {
    const vers = typeDe(m.versCompteId) === 'investissement', de = typeDe(m.compteId) === 'investissement'
    if (m.type === 'investissement' || (m.type === 'virement' && vers && !de)) return s + m.montant
    if (m.type === 'virement' && de && !vers) return s - m.montant
    return s
  }, 0)
  const fixesRestantes = fixesRestantesDuMois(d, mois)
  return { revenus, depenses, fixesRestantes, investi, epargne: revenus - depenses }
}

/**
 * Reste à vivre (mois en cours) : l'argent disponible aujourd'hui, compte(s) courant(s) + espèces,
 * moins les charges fixes et les abonnements encore à payer ce mois-ci, plus les revenus réguliers attendus
 * avant le 25, moins les revenus déjà reçus qui servent au mois suivant (salaire du 28). Part de ce que tu as vraiment.
 */
export function resteAVivre(d: Donnees, jour: string) {
  const mois = moisDe(jour)
  const disponibles = d.comptes.filter((c) => (c.type === 'courant' || c.type === 'especes') && !c.archive && c.dateDepart <= jour)
  const solde = (type: Compte['type']) => disponibles.filter((c) => c.type === type).reduce((s, c) => s + soldeAu(c, d.mouvements, d.releves, jour), 0)
  const courant = solde('courant')
  const especes = solde('especes')
  const fixesRestantes = fixesRestantesDuMois(d, mois)
  const v = aVenir(d, jour)
  const abonnements = sommeAbonnements(v.depenses)
  const revenusAttendus = sommeAbonnements(v.revenus)
  const ids = new Set(disponibles.map((c) => c.id))
  const pourMoisSuivant = d.mouvements
    .filter((m) => m.type === 'revenu' && !estRemboursement(m) && moisDe(m.date) === mois && m.date <= jour && moisDuRevenu(m.date) !== mois && ids.has(m.compteId))
    .reduce((s, m) => s + m.montant, 0)
  return {
    courant, especes, fixesRestantes, abonnements, revenusAttendus, pourMoisSuivant,
    reste: courant + especes - fixesRestantes - abonnements + revenusAttendus - pourMoisSuivant,
  }
}

function fixesRestantesDuMois(d: Donnees, mois: string) {
  return detailFixesRestantes(d, mois).reduce((s, x) => s + x.montant, 0)
}

/**
 * Règle 50/30/20 (E. Warren) : besoins, loisirs et épargne d'un mois, en part des revenus du mois.
 * Besoin ou loisir : celui de la sous-catégorie s'il est précisé (ex. Spotify = loisir), sinon celui de la catégorie.
 * Épargne = revenus − dépenses. Dépenses sans nature (ex. « À catégoriser ») : à part.
 */
export function repartition503020(d: Donnees, mois: string) {
  const parCat = depensesParCategorie(d.mouvements, d.categories, mois, true)
  const natureDe = (id: string) => {
    const c = d.categories.find((x) => x.id === id)
    return c?.nature ?? d.categories.find((x) => x.id === c?.parentId)?.nature
  }
  const somme = (nature?: Categorie['nature']) => [...parCat].filter(([id]) => natureDe(id) === nature).reduce((s, [, v]) => s + v, 0)
  const r = resumeMois(d, mois)
  return { revenus: r.revenus, besoins: somme('besoin'), loisirs: somme('loisir'), autres: somme(undefined), epargne: Math.max(0, r.epargne) }
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
  // Pas de comparaison avec un mois pas encore suivi
  const debutSuiviDu = debutSuivi(d.comptes)
  const comparable = !!debutSuiviDu && debutSuiviDu <= premierJour(decalerMois(mois, -1))
  const ecarts = (comparable ? [...new Set([...ce.keys(), ...avant.keys()])] : [])
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
