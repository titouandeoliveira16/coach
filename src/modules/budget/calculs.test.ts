import { describe, expect, it } from 'vitest'
import { formatEuros } from '../../core/format'
import {
  bilanMois, categoriesParUsage, couleurJauge, decalerMois, dernierJour, patrimoineAu, plafondDe, previsionFinDeMois,
  resumeMois, seuilFranchi, soldeAu, verseAu, type Donnees,
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
  it('jauge : vert < 75 %, orange jusqu’à 100 %, rouge au-delà', () => {
    expect(couleurJauge(7000, 10000)).toBe('vert')
    expect(couleurJauge(7500, 10000)).toBe('orange')
    expect(couleurJauge(10000, 10000)).toBe('orange')
    expect(couleurJauge(10001, 10000)).toBe('rouge')
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
  it('reste à vivre = revenus − dépenses − charges fixes encore prévues', () => {
    const r = resumeMois(d, '2026-10')
    expect(r).toMatchObject({ revenus: 120000, depenses: 30000, fixesRestantes: 40000, resteAVivre: 50000, epargne: 30000, investi: 0 })
  })
  it('prévision fin de mois au rythme actuel', () => {
    const p = previsionFinDeMois(d, '2026-10-10')
    // 100 000 + 120 000 − 30 000 − 30 000 = 160 000 ; rythme 30 000 / 10 j = 3 000/j ; 21 j restants
    expect(p.solde).toBe(160000)
    expect(p.prevision).toBe(160000 - 40000 - 3000 * 21)
  })
  it('bilan : catégories dépassées et écarts avec le mois précédent', () => {
    const b = bilanMois(d, '2026-10')
    expect(b.depassees).toEqual([{ categorieId: 'courses', depense: 25000, plafond: 20000 }])
    expect(b.hausses[0]).toEqual({ categorieId: 'courses', ecart: 25000 })
    expect(b.patrimoineDebut).toBeUndefined()
  })
})

it('format des euros à la française', () => {
  expect(formatEuros(123456).replace(/\s/g, ' ')).toBe('1 234,56 €')
  expect(formatEuros(500, { signe: true })).toMatch(/^\+5,00/)
})
