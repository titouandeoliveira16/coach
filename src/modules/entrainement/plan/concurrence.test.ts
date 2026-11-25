import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { decalerJour } from '../../../core/dates'
import { enregistrerArrivee, semaineDepuisJours } from '../arrivee/donnees'
import { construireSaison, genererSemaineVelo } from './programme'

// 25/11/2026 : deux reconstructions en même temps (lancement + changement de réglage) écrivaient chaque semaine en double
it('deux calculs lancés en même temps ne doublent jamais une semaine', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T07:00:00'))
  await enregistrerArrivee({
    naissance: '1998-03-03', sexe: 'homme', tailleCm: 178, poidsKg: 70, cpW: 260, discipline: 'route', anciennete: '3 à 5 ans',
    heuresRecentes: '6 à 10 h', intervalles: true, arretSemaines: 0, heuresSemaine: '8 à 10 h', nutrition: true,
    semaineType: semaineDepuisJours(5), maxSemaineMin: 75, minLongMin: 120, maxLongMin: 240, course: { nom: 'Objectif', date: '2027-03-14' },
  })
  await genererSemaineVelo('2026-11-09')
  await Promise.all([construireSaison(true), construireSaison(true), genererSemaineVelo('2026-11-23'), genererSemaineVelo('2026-11-23')])
  const velo = (await db.prevues.toArray()).filter((p) => p.sport === 'velo' && p.statut === 'prevue')
  for (let l = '2026-11-16'; l <= '2027-03-01'; l = decalerJour(l, 7)) {
    const jours = velo.filter((p) => p.date >= l && p.date <= decalerJour(l, 6)).map((p) => p.date)
    expect(jours.length, `semaine du ${l}`).toBe(new Set(jours).size)
  }
  vi.useRealTimers()
}, 120_000)
