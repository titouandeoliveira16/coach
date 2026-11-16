import { describe, expect, it } from 'vitest'
import { formatEuros } from '../../core/format'
import {
  bilanMois, categoriesParUsage, couleurJauge, decalerMois, depensesParCategorie, dernierJour, patrimoineAu, plafondDe, repartition503020,
  resteAVivre, resumeMois, seuilFranchi, soldeAu, verseAu, type Donnees,
} from './calculs'
import type { Categorie, Compte, Mouvement } from './types'

const compte = (id: string, type: Compte['type'], soldeInitial: number, dateDepart = '2026-10-01'): Compte =>
  ({ id, nom: id, type, soldeInitial, dateDepart, ordre: 0 })
const cat = (id: string, extra: Partial<Categorie> = {}): Categorie =>
  ({ id, nom: id, emoji: '', couleur: '', genre: 'depense', ordre: 0, ...extra })
let n = 0
const mvt = (m: Omit<Mouvement, 'id'>): Mouvement => ({ id: String(n++), ...m })

const comptes = [compte('courant', 'courant', 100000), compte('livret', 'epargne', 500000), compte('pea', 'investissement', 200000)]
const categories = [cat('logement', { fixe: true }), cat('courses'), cat('sport'), cat('velo', { parentId: 'sport' }), cat('salaire', { genre: 'revenu' })]

describe('mois', () => {
  it('décale et trouve le dernier jour', () => {
    expect(decalerMois('2026-12', 1)).toBe('2027-01')
    expect(decalerMois('2026-01', -1)).toBe('2025-12')
    expect(dernierJour('2027-02')).toBe('2027-02-28')
  })
})

describe('soldes', () => {
  const mouvements = [
    mvt({ type: 'depense', montant: 5000, date: '2026-10-01', compteId: 'courant', categorieId: 'courses' }),
    mvt({ type: 'revenu', montant: 80000, date: '2026-10-05', compteId: 'courant', categorieId: 'salaire' }),
    mvt({ type: 'virement', montant: 20000, date: '2026-10-06', compteId: 'courant', versCompteId: 'livret' }),
    mvt({ type: 'investissement', montant: 10000, date: '2026-10-07', compteId: 'courant', versCompteId: 'pea' }),
  ]
  it('part du solde initial (début du jour de départ) et ajoute les mouvements', () => {
    expect(soldeAu(comptes[0], mouvements, [], '2026-10-01')).toBe(95000)
    expect(soldeAu(comptes[0], mouvements, [], '2026-10-31')).toBe(100000 - 5000 + 80000 - 20000 - 10000)
    expect(soldeAu(comptes[1], mouvements, [], '2026-10-31')).toBe(520000)
  })
  it('un relevé fixe la valeur, les versements suivants s’y ajoutent', () => {
    const releves = [{ id: 'pea|2026-10-06', compteId: 'pea', date: '2026-10-06', valeur: 210000 }]
    expect(soldeAu(comptes[2], mouvements, releves, '2026-10-31')).toBe(220000)
    expect(verseAu(comptes[2], mouvements, '2026-10-31')).toBe(210000)
  })
  it('patrimoine = somme des comptes', () => {
    expect(patrimoineAu(comptes, mouvements, [], '2026-10-31')).toBe(100000 + 500000 + 200000 - 5000 + 80000)
  })
})

describe('budget', () => {
  it('plafond : repris des mois précédents, modifiable sans toucher au passé', () => {
    const plafonds = [
      { id: 'courses|2026-10', categorieId: 'courses', mois: '2026-10', montant: 20000 },
      { id: 'courses|2026-12', categorieId: 'courses', mois: '2026-12', montant: 25000 },
    ]
    expect(plafondDe('courses', '2026-09', plafonds)).toBeUndefined()
    expect(plafondDe('courses', '2026-11', plafonds)).toBe(20000)
    expect(plafondDe('courses', '2027-01', plafonds)).toBe(25000)
  })
  it('jauge : vert < 75 %, orange jusqu’à 110 %, rouge au-delà', () => {
    expect(couleurJauge(7000, 10000)).toBe('vert')
    expect(couleurJauge(7500, 10000)).toBe('orange')
    expect(couleurJauge(10000, 10000)).toBe('orange')
    expect(couleurJauge(11001, 10000)).toBe('rouge')
  })
  it('alerte à 90 % puis à 100 %', () => {
    expect(seuilFranchi(8000, 9000, 10000)).toBe(90)
    expect(seuilFranchi(9000, 9500, 10000)).toBeUndefined()
    expect(seuilFranchi(9500, 10000, 10000)).toBe(100)
    expect(seuilFranchi(5000, 12000, 10000)).toBe(100)
    expect(seuilFranchi(5000, 12000, undefined)).toBeUndefined()
  })
  it('les catégories les plus utilisées passent devant', () => {
    const m = [mvt({ type: 'depense', montant: 100, date: '2026-10-20', compteId: 'courant', categorieId: 'velo' })]
    expect(categoriesParUsage(categories, m, 'depense', '2026-10-26').map((c) => c.id)).toEqual(['sport', 'logement', 'courses'])
  })

  const d: Donnees = {
    comptes,
    categories,
    releves: [],
    plafonds: [
      { id: 'logement|2026-10', categorieId: 'logement', mois: '2026-10', montant: 40000 },
      { id: 'courses|2026-10', categorieId: 'courses', mois: '2026-10', montant: 20000 },
    ],
    mouvements: [
      mvt({ type: 'revenu', montant: 120000, date: '2026-10-02', compteId: 'courant', categorieId: 'salaire' }),
      mvt({ type: 'depense', montant: 10000, date: '2026-10-08', compteId: 'courant', categorieId: 'courses' }),
      mvt({ type: 'depense', montant: 15000, date: '2026-10-09', compteId: 'courant', categorieId: 'courses' }),
      mvt({ type: 'depense', montant: 5000, date: '2026-10-10', compteId: 'courant', categorieId: 'velo' }),
      mvt({ type: 'virement', montant: 30000, date: '2026-10-10', compteId: 'courant', versCompteId: 'livret' }),
    ],
  }
  it('résumé du mois ; reste à vivre = argent disponible (courant + espèces) − charges fixes encore prévues', () => {
    const r = resumeMois(d, '2026-10')
    // Mis de côté = revenus − dépenses (le virement vers le livret n'en est qu'une partie)
    expect(r).toMatchObject({ revenus: 120000, depenses: 30000, fixesRestantes: 40000, epargne: 90000, investi: 0 })
    // 100 000 au départ + 120 000 − 30 000 − 30 000 (mis sur le livret) = 160 000 ; − 40 000 de charges fixes
    expect(resteAVivre(d, '2026-10-10')).toMatchObject({ courant: 160000, especes: 0, reste: 120000 })
  })
  it('abonnements : comptés d’avance, à vérifier dès le jour du prélèvement, sortis du système « charge fixe »', async () => {
    const { abonnementsAVenir, abonnementsAVerifier } = await import('./calculs')
    const spotify = { id: 'sp', nom: 'Spotify', montant: 1099, categorieId: 'courses', compteId: 'courant', jour: 15, actif: true, depuis: '2026-10-01' }
    const avec: Donnees = { ...d, abonnements: [spotify], etatsAbonnements: {} }
    expect(abonnementsAVenir(avec, '2026-10-10')).toHaveLength(1)
    expect(abonnementsAVerifier(avec, '2026-10-10')).toHaveLength(0)
    expect(abonnementsAVerifier(avec, '2026-10-15')).toHaveLength(1)
    // Courses (plafond fixe ? non) : seul l'abonnement est retiré en plus
    expect(resteAVivre(avec, '2026-10-10').abonnements).toBe(1099)
    // Payé, sauté ou remis à demain
    expect(abonnementsAVenir({ ...avec, etatsAbonnements: { 'sp|2026-10': { statut: 'paye' } } }, '2026-10-16')).toHaveLength(0)
    expect(abonnementsAVerifier({ ...avec, etatsAbonnements: { 'sp|2026-10': { relance: '2026-10-17' } } }, '2026-10-16')).toHaveLength(0)
    // Créé après l'échéance du mois : rien pour ce mois-là
    expect(abonnementsAVenir({ ...avec, abonnements: [{ ...spotify, depuis: '2026-10-20' }] }, '2026-10-25')).toHaveLength(0)
    // Mois court : le 31 devient le 30
    expect(abonnementsAVerifier({ ...avec, abonnements: [{ ...spotify, jour: 31 }] }, '2026-11-30').map((x) => x.mois)).toEqual(['2026-10', '2026-11'])
  })

  it('bilan : catégories dépassées ; pas de comparaison avec un mois pas encore suivi', () => {
    const b = bilanMois(d, '2026-10')
    expect(b.depassees).toEqual([{ categorieId: 'courses', depense: 25000, plafond: 20000 }])
    expect(b.hausses).toEqual([])
    expect(b.patrimoineDebut).toBeUndefined()
    const novembre = { ...d, mouvements: [...d.mouvements, mvt({ type: 'depense', montant: 40000, date: '2026-11-03', compteId: 'courant', categorieId: 'courses' })] }
    expect(bilanMois(novembre, '2026-11').hausses[0]).toEqual({ categorieId: 'courses', ecart: 15000 })
  })
})

it('format des euros à la française', () => {
  expect(formatEuros(123456).replace(/\s/g, ' ')).toBe('1 234,56 €')
  expect(formatEuros(500, { signe: true })).toMatch(/^\+5,00/)
})

describe('contrôle du dimanche', () => {
  it('à faire dès le dimanche, jusqu’à ce qu’il soit fait', async () => {
    const { controleAFaire } = await import('./calculs')
    expect(controleAFaire(undefined, '2026-11-01')).toBe(true)
    expect(controleAFaire('2026-11-01', '2026-11-01')).toBe(false)
    expect(controleAFaire('2026-11-01', '2026-11-07')).toBe(false)
    expect(controleAFaire('2026-11-01', '2026-11-08')).toBe(true)
    expect(controleAFaire('2026-10-25', '2026-11-03')).toBe(true)
  })
})

describe('revenus réguliers et fin de mois', () => {
  const d0: Donnees = { comptes: [compte('courant', 'courant', 50000)], mouvements: [], categories, plafonds: [], releves: [] }
  const salaire = { id: 'sal', nom: 'Salaire', montant: 90000, categorieId: 'salaire', compteId: 'courant', jour: 30, actif: true, depuis: '2026-10-01' }
  const job = { ...salaire, id: 'job', nom: 'Job', montant: 30000, jour: 5 }

  it('un revenu du 25 ou après compte pour le mois suivant dans les bilans', async () => {
    const { moisDuRevenu } = await import('./calculs')
    expect(moisDuRevenu('2026-10-24')).toBe('2026-10')
    expect(moisDuRevenu('2026-10-30')).toBe('2026-11')
    expect(moisDuRevenu('2026-12-31')).toBe('2027-01')
    const d: Donnees = { ...d0, mouvements: [mvt({ type: 'revenu', montant: 90000, date: '2026-10-30', compteId: 'courant', categorieId: 'salaire' })] }
    expect(resumeMois(d, '2026-10').revenus).toBe(0)
    expect(resumeMois(d, '2026-11').revenus).toBe(90000)
    // Le solde, lui, change le jour même
    expect(soldeAu(d.comptes[0], d.mouvements, [], '2026-10-30')).toBe(140000)
  })

  it('revenus attendus : ajoutés au reste à vivre, sauf ceux de fin de mois', () => {
    const d: Donnees = { ...d0, abonnements: [salaire, job], etatsAbonnements: {} }
    const r = resteAVivre(d, '2026-11-03')
    expect(r.revenusAttendus).toBe(30000)
    expect(r.abonnements).toBe(0)
    expect(r.reste).toBe(80000)
    // Arrivé et confirmé : plus attendu
    expect(resteAVivre({ ...d, etatsAbonnements: { 'job|2026-11': { statut: 'paye' } } }, '2026-11-06').revenusAttendus).toBe(0)
  })

  it('export CSV : comptes, mouvements, mois de rattachement', async () => {
    const { exporterCsv } = await import('./exporter')
    const d: Donnees = { ...d0, mouvements: [mvt({ type: 'revenu', montant: 90000, date: '2026-10-30', compteId: 'courant', categorieId: 'salaire', note: '-20 pour Léo' })] }
    const csv = exporterCsv(d, '2026-11-03')
    expect(csv).toContain('"courant";courant;2026-10-01;1400,00')
    // Une note qui commence par « - » n'est pas lue comme une formule par Excel ou Numbers
    expect(csv).toContain(`2026-10-30;revenu;900,00;"courant";"";"salaire";"'-20 pour Léo";2026-11`)
  })
})

describe('audit Budget 11/2026', () => {
  const base: Donnees = {
    comptes: [compte('courant', 'courant', 100000, '2026-11-01'), compte('especes', 'especes', 0, '2026-11-01'), compte('pea', 'investissement', 0, '2026-11-01'), compte('livret', 'epargne', 50000, '2026-11-01')],
    mouvements: [], plafonds: [], releves: [],
    categories: [...categories, cat('sorties'), cat('abonnements', { nature: 'besoin', fixe: true }), cat('abonnements-spotify', { parentId: 'abonnements', nature: 'loisir' }),
      cat('remboursement', { genre: 'revenu' })],
  }

  it('un remboursement vient en moins de la dépense remboursée, pas dans les revenus', () => {
    const d: Donnees = { ...base, mouvements: [
      mvt({ type: 'depense', montant: 12000, date: '2026-11-20', compteId: 'courant', categorieId: 'sorties' }),
      mvt({ type: 'revenu', montant: 9000, date: '2026-11-26', compteId: 'courant', categorieId: 'remboursement', rembourse: 'sorties' }),
      mvt({ type: 'revenu', montant: 80000, date: '2026-11-02', compteId: 'courant', categorieId: 'salaire' }),
    ] }
    expect(depensesParCategorie(d.mouvements, d.categories, '2026-11').get('sorties')).toBe(3000)
    // Même reçu le 26 : il reste en novembre (ce n'est pas un salaire de fin de mois)
    expect(resumeMois(d, '2026-11')).toMatchObject({ revenus: 80000, depenses: 3000, epargne: 77000 })
    expect(resumeMois(d, '2026-12').revenus).toBe(0)
    // Jamais en dessous de 0 pour une catégorie
    const seul = { ...d, mouvements: d.mouvements.slice(1) }
    expect(depensesParCategorie(seul.mouvements, seul.categories, '2026-11').has('sorties')).toBe(false)
  })

  it('livret → PEA : pas d’épargne en plus ; un virement vers un placement compte comme investi', () => {
    const d: Donnees = { ...base, mouvements: [
      mvt({ type: 'revenu', montant: 80000, date: '2026-11-02', compteId: 'courant', categorieId: 'salaire' }),
      mvt({ type: 'virement', montant: 40000, date: '2026-11-05', compteId: 'livret', versCompteId: 'pea' }),
    ] }
    expect(resumeMois(d, '2026-11')).toMatchObject({ epargne: 80000, investi: 40000 })
    expect(repartition503020(d, '2026-11').epargne).toBe(80000)
  })

  it('50/30/20 : la nature de la sous-catégorie l’emporte (Spotify = loisir)', () => {
    const d: Donnees = { ...base, mouvements: [
      mvt({ type: 'depense', montant: 1199, date: '2026-11-05', compteId: 'courant', categorieId: 'abonnements-spotify' }),
      mvt({ type: 'depense', montant: 1000, date: '2026-11-05', compteId: 'courant', categorieId: 'abonnements' }),
    ] }
    expect(repartition503020(d, '2026-11')).toMatchObject({ loisirs: 1199, besoins: 1000 })
  })

  it('jauges : rouge seulement au-delà de 110 %', () => {
    expect(couleurJauge(10500, 10000)).toBe('orange')
    expect(couleurJauge(11001, 10000)).toBe('rouge')
  })

  it('reste à vivre : le salaire du 28 déjà reçu sert au mois suivant', () => {
    const d: Donnees = { ...base, mouvements: [mvt({ type: 'revenu', montant: 80000, date: '2026-11-28', compteId: 'courant', categorieId: 'salaire' })] }
    const r = resteAVivre(d, '2026-11-28')
    expect(r.courant).toBe(180000)
    expect(r.pourMoisSuivant).toBe(80000)
    expect(r.reste).toBe(100000)
  })

  it('abonnements : celui du 30 pas confirmé est redemandé le mois suivant ; une saisie à la main le règle', async () => {
    const { abonnementsAVerifier, aVenir } = await import('./calculs')
    const spotify = { id: 'sp', nom: 'Spotify', montant: 1199, categorieId: 'abonnements-spotify', compteId: 'courant', jour: 30, actif: true, depuis: '2026-11-01' }
    const d: Donnees = { ...base, abonnements: [spotify], etatsAbonnements: {} }
    expect(abonnementsAVerifier(d, '2026-12-02')).toEqual([{ a: spotify, mois: '2026-11' }])
    expect(aVenir(d, '2026-12-02').depenses.filter((a) => a.id === 'sp')).toHaveLength(2)
    const saisi = { ...d, mouvements: [mvt({ type: 'depense', montant: 1199, date: '2026-11-30', compteId: 'courant', categorieId: 'abonnements' })] }
    expect(abonnementsAVerifier(saisi, '2026-12-02')).toEqual([])
  })

  it('charge fixe + abonnement de la même catégorie : seul le reste de la charge fixe est compté en plus', async () => {
    const { detailFixesRestantes } = await import('./calculs')
    const spotify = { id: 'sp', nom: 'Spotify', montant: 1199, categorieId: 'abonnements-spotify', compteId: 'courant', jour: 30, actif: true, depuis: '2026-11-01' }
    const d: Donnees = { ...base, plafonds: [{ id: 'abonnements|2026-11', categorieId: 'abonnements', mois: '2026-11', montant: 5000 }], abonnements: [spotify], etatsAbonnements: {} }
    expect(detailFixesRestantes(d, '2026-11')[0].montant).toBe(5000 - 1199)
    expect(resteAVivre(d, '2026-11-10').reste).toBe(100000 - 5000)
  })
})
