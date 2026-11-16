import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { aujourdhui } from '../../core/dates'
import { db } from '../../core/db'
import { enregistrer } from '../../core/stockage'
import { soldeAu } from './calculs'
import { importer, lireImport } from './importer'

it('import : mouvements ajoutés une seule fois, solde du jour recalé', async () => {
  await enregistrer(db.comptes, { id: 'courant', nom: 'Compte courant', type: 'courant', soldeInitial: 10000, dateDepart: aujourdhui(), ordre: 0 })
  await enregistrer(db.categories, { id: 'courses', nom: 'Courses', emoji: '🛒', couleur: '', genre: 'depense', ordre: 0 })
  const f = lireImport(JSON.stringify({
    mouvements: [
      { type: 'depense', montant: 12.5, date: '2026-10-15', categorie: 'courses' },
      { type: 'depense', montant: 3, date: '2026-10-15', categorie: 'inconnue', note: 'x' },
      { type: 'revenu', montant: 100, date: '2026-10-15' },
    ],
    soldes: { courant: 4.46 },
  }))
  expect(await importer(f)).toEqual({ ajoutes: 3, deja: 0 })
  expect(await importer(f)).toEqual({ ajoutes: 0, deja: 3 })
  expect((await db.mouvements.toArray()).map((m) => m.categorieId).sort()).toEqual(['autre-revenu', 'courses', 'divers'])
  expect(soldeAu((await db.comptes.get('courant'))!, await db.mouvements.toArray(), [], aujourdhui())).toBe(446)
  expect(() => lireImport('{"mouvements":[{"type":"depense","montant":-1,"date":"2026-10-15"}]}')).toThrow(/Ligne 1/)
})

it('import : vérifications, lignes identiques gardées, identifiants courts', async () => {
  const ligne = (m: object) => JSON.stringify({ mouvements: [m] })
  expect(() => lireImport(ligne({ type: 'depense', montant: '12', date: '2026-10-15' }))).toThrow(/montant/)
  expect(() => lireImport(ligne({ type: 'depense', montant: 12, date: '2026-13-45' }))).toThrow(/date/)
  expect(() => lireImport(ligne({ type: 'depense', montant: 12, date: '2026-10-15', note: 5 }))).toThrow(/texte/)
  expect(() => lireImport(ligne({ type: 'virement', montant: 12, date: '2026-10-15' }))).toThrow(/vers/)
  expect(() => lireImport(JSON.stringify({ mouvements: [], soldes: { courant: 'x' } }))).toThrow(/Soldes/)
  await expect(importer(lireImport(ligne({ type: 'virement', montant: 12, date: '2026-10-15', vers: 'nulle-part' })))).rejects.toThrow(/inconnu/)
  const cafe = { type: 'depense', montant: 1.5, date: '2026-10-16', categorie: 'courses' }
  const longue = { ...cafe, montant: 2, note: 'x'.repeat(400) }
  const f = lireImport(JSON.stringify({ mouvements: [cafe, cafe, longue] }))
  expect(await importer(f)).toEqual({ ajoutes: 3, deja: 0 })
  expect((await db.mouvements.toArray()).every((m) => m.id.length < 200)).toBe(true)
  expect(await importer(f)).toEqual({ ajoutes: 0, deja: 3 })
})
