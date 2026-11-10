import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { enregistrerArrivee, migrerSaisonV2, semaineDepuisJours } from './donnees'

it('une saison d’avant la 10.5 est recalculée une fois avec la prépa hivernale', async () => {
  await db.delete(); await db.open()
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-09T07:00:00'))
  await enregistrerArrivee({ naissance: '1998-03-03', sexe: 'homme', tailleCm: 178, poidsKg: 70, cpW: 260, discipline: 'route', anciennete: '3 à 5 ans', heuresRecentes: '6 à 10 h', intervalles: true, arretSemaines: 0, heuresSemaine: '8 à 10 h', nutrition: true, semaineType: semaineDepuisJours(4), maxSemaineMin: 75, minLongMin: 90, maxLongMin: 120, course: { nom: 'A', date: '2027-06-05' } })
  const e = (await db.reglages.get('entrainement'))!.valeur as { programme: Record<string, unknown> }
  // Ancienne saison : 8 semaines de reprise, sans le drapeau
  await db.reglages.put({ id: 'entrainement', valeur: { ...e, programme: { ...e.programme, saisonV2: undefined, phases: [{ debut: '2026-11-09', type: 'reprise' }, { debut: '2027-01-04', type: 'seuil-tirage' }] } } } as never)
  vi.setSystemTime(new Date('2026-11-11T07:00:00'))
  await migrerSaisonV2()
  const p = ((await db.reglages.get('entrainement'))!.valeur as { programme: { phases: { type: string }[]; saisonV2: boolean } }).programme
  expect(p.saisonV2).toBe(true)
  expect(p.phases.map((x) => x.type)).toContain('base')
  expect(p.phases.map((x) => x.type)).toContain('fin-prepa')
  vi.useRealTimers()
}, 30_000)
