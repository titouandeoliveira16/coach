import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db } from '../core/db'
import { enregistrer } from '../core/stockage'
import { importerDonnees, lireFichierDonnees } from './importDonnees'

it('import de données personnelles : profil fusionné, zones seulement si absentes, records, soldes de départ', async () => {
  await enregistrer(db.reglages, { id: 'profil', valeur: { objectif: 'perte' } })
  await enregistrer(db.reglages, { id: 'entrainement', valeur: { cpW: 250 } })
  await enregistrer(db.comptes, { id: 'livret-a', nom: 'Livret A', type: 'epargne', soldeInitial: 0, dateDepart: '2026-10-26', ordre: 1 })
  const fait = await importerDonnees(lireFichierDonnees(JSON.stringify({
    profil: { tailleCm: 180, naissance: '2000-01-01' },
    entrainement: { cpW: 999, vmaKmh: 18 },
    recordsPuissance: { 5: { w: 900, date: '2026-08-01' } },
    comptesDepart: { 'livret-a': { solde: 1234.5, date: '2026-10-01' }, inconnu: { solde: 1, date: '2026-10-01' } },
  })))
  expect(fait).toHaveLength(4)
  expect((await db.reglages.get('profil'))?.valeur).toEqual({ objectif: 'perte', tailleCm: 180, naissance: '2000-01-01' })
  expect((await db.reglages.get('entrainement'))?.valeur).toEqual({ cpW: 250, vmaKmh: 18 })
  expect(await db.comptes.get('livret-a')).toMatchObject({ soldeInitial: 123450, dateDepart: '2026-10-01' })
  expect(() => lireFichierDonnees('{}')).toThrow()
})
