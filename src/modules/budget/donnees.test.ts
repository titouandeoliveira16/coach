import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db } from '../../core/db'
import { enregistrer, supprimer } from '../../core/stockage'
import { mettreAJour } from './donnees'

it('mise à jour unique : catégories choisies, comptes Trade Republic renommés, soldes et relevés intacts', async () => {
  await enregistrer(db.comptes, { id: 'pea', nom: 'PEA', type: 'investissement', soldeInitial: 300000, dateDepart: '2026-10-26', ordre: 6 })
  await enregistrer(db.comptes, { id: 'courant', nom: 'Compte courant', type: 'courant', soldeInitial: 50000, dateDepart: '2026-10-26', ordre: 0 })
  await enregistrer(db.categories, { id: 'logement', nom: 'Logement', emoji: '🏠', couleur: '#60a5fa', genre: 'depense', fixe: true, ordre: 0 })
  await enregistrer(db.mouvements, { id: 'm1', type: 'depense', montant: 1000, date: '2026-10-26', compteId: 'courant', categorieId: 'logement' })
  await enregistrer(db.releves, { id: 'pea|2026-10-26', compteId: 'pea', date: '2026-10-26', valeur: 305000 })

  await mettreAJour()

  expect(await db.comptes.get('pea')).toMatchObject({ soldeInitial: 300000, dateDepart: '2026-10-26', nom: 'PEA (Trade Republic)' })
  expect(await db.releves.count()).toBe(1)
  expect((await db.categories.get('logement'))?.archive).toBe(true)
  expect((await db.mouvements.get('m1'))?.categorieId).toBe('maison')
  expect(await db.categories.get('abonnements-spotify')).toMatchObject({ parentId: 'abonnements', nom: 'Spotify' })
  expect((await db.categories.get('abonnements'))?.fixe).toBeUndefined()
  expect((await db.categories.get('sorties'))?.nature).toBe('loisir')
  await supprimer(db.releves, 'pea|2026-10-26')
})

it('remise à zéro : comptes et mouvements effacés, catégories gardées', async () => {
  const { remettreAZero, demarrer } = await import('./donnees')
  await remettreAZero()
  expect(await db.comptes.count()).toBe(0)
  expect(await db.mouvements.count()).toBe(0)
  expect(await db.categories.count()).toBeGreaterThan(0)
  await demarrer({ courant: 12345, 'livret-a': 50000 }, '2026-11-01', '2026-10-01')
  expect(await db.comptes.get('courant')).toMatchObject({ soldeInitial: 12345, dateDepart: '2026-11-01' })
  expect(await db.comptes.get('livret-a')).toMatchObject({ soldeInitial: 50000, dateDepart: '2026-10-01' })
  expect(await db.comptes.get('pea')).toMatchObject({ soldeInitial: 0, nom: 'PEA (Trade Republic)' })
})

it('un relevé daté d’avant le départ d’un compte devient son point de départ', async () => {
  const { alignerDepartsSurReleves } = await import('./donnees')
  const { soldeAu } = await import('./calculs')
  await enregistrer(db.comptes, { id: 'livret-a', nom: 'Livret A', type: 'epargne', soldeInitial: 0, dateDepart: '2026-11-01', ordre: 1 })
  await enregistrer(db.releves, { id: 'livret-a|2026-10-01', compteId: 'livret-a', date: '2026-10-01', valeur: 98400 })
  await alignerDepartsSurReleves()
  const c = (await db.comptes.get('livret-a'))!
  expect(c).toMatchObject({ dateDepart: '2026-10-01', soldeInitial: 98400 })
  // Le relevé suivant (ex. le 5/11) prend le relais
  const releves = [...(await db.releves.toArray()), { id: 'livret-a|2026-11-05', compteId: 'livret-a', date: '2026-11-05', valeur: 99000 }]
  expect(soldeAu(c, [], releves, '2026-10-28')).toBe(98400)
  expect(soldeAu(c, [], releves, '2026-11-06')).toBe(99000)
})
