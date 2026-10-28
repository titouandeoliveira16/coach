import 'fake-indexeddb/auto'
import { expect, it } from 'vitest'
import { db } from '../../core/db'
import { annulerDerniere, demarrer, noterSeance } from './donnees'

const etat = async () => (await db.reglages.get('muscu'))!.valeur as { reference: number; cycle: number; semaine: number; seances: unknown[] }

it('un cycle complet : 4 séances, puis nouvelle référence ; annuler une séance', async () => {
  await demarrer(100, 1) // objectif par défaut : maintien → 90 %
  expect(await etat()).toMatchObject({ reference: 90, cycle: 1, semaine: 1 })
  await noterSeance(8, 76.5)
  await noterSeance(5, 81)
  expect((await etat()).semaine).toBe(3)
  expect(await noterSeance(3, 85.5)).toMatch(/\+2,5 kg/)
  await noterSeance(undefined, undefined)
  expect(await etat()).toMatchObject({ reference: 92.5, cycle: 2, semaine: 1 })
  await annulerDerniere()
  expect(await etat()).toMatchObject({ reference: 90, cycle: 1, semaine: 4 })
  expect((await etat()).seances).toHaveLength(3)
})
