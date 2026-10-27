import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db } from './db'
import { enregistrer, supprimer } from './stockage'

it('une ligne supprimée puis recréée n’a plus de suppression en attente', async () => {
  await enregistrer(db.reglages, { id: 'x', valeur: 1 })
  await supprimer(db.reglages, 'x')
  expect(await db.suppressions.count()).toBe(1)
  await db.transaction('rw', db.reglages, db.suppressions, () => enregistrer(db.reglages, { id: 'x', valeur: 2 }))
  expect(await db.suppressions.count()).toBe(0)
})
