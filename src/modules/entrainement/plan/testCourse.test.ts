import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrerArrivee, semaineDepuisJours } from '../arrivee/donnees'
import { genererSemaineVelo } from './programme'

it('un test CP 2 jours après une course est décalé d’une semaine', async () => {
  await db.delete(); await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T07:00:00'))
  await enregistrerArrivee({
    naissance: '1998-03-03', sexe: 'homme', tailleCm: 178, poidsKg: 70, cpW: 260, discipline: 'route', anciennete: '3 à 5 ans', heuresRecentes: '6 à 10 h',
    intervalles: true, arretSemaines: 0, heuresSemaine: '8 à 10 h', nutrition: true, semaineType: semaineDepuisJours(5), maxSemaineMin: 75, minLongMin: 120, maxLongMin: 240,
    course: { nom: 'A', date: '2027-05-16' }, autresCourses: [{ date: '2027-02-14', nom: 'Course C', niveau: 'C', epreuve: 'en-ligne', dureeMin: 120 }],
  })
  const e = (await db.reglages.get('entrainement'))!.valeur as { programme: { testsCp: string[] } }
  await db.reglages.put({ id: 'entrainement', valeur: { ...e, programme: { ...e.programme, testsCp: [...e.programme.testsCp, '2027-02-16'].sort() } } } as never)
  vi.setSystemTime(new Date('2027-02-15T06:00:00'))
  await genererSemaineVelo('2027-02-15')
  const apres = (await db.reglages.get('entrainement'))!.valeur as { programme: { testsCp: string[] } }
  expect(apres.programme.testsCp).not.toContain('2027-02-16')
  expect(apres.programme.testsCp).toContain('2027-02-23')
  const semaine = await db.prevues.where('date').between('2027-02-15', '2027-02-21', true, true).toArray()
  expect(semaine.some((p) => p.velo?.famille === 'test')).toBe(false)
  vi.useRealTimers()
}, 30_000)
