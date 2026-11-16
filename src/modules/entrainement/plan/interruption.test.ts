import 'fake-indexeddb/auto'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { debutCalcul } from '../../../core/calcul'
import { enregistrer, supprimer } from '../../../core/stockage'
import { genererSemaineVelo } from './programme'

// Calcul de semaine coupé en plein milieu (audit du 14/11/2026, corrigé le 16/11) : au démarrage suivant, la semaine
// d'avant est remise puis recalculée, jamais laissée à moitié vide.
const memoire = new Map<string, string>()
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-25T18:00:00'))
  vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => memoire.set(k, v), removeItem: (k: string) => memoire.delete(k) })
})
afterAll(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('appli coupée après les suppressions : la semaine est remise puis recalculée au démarrage', async () => {
  await genererSemaineVelo('2026-10-26')
  const avant = await db.prevues.where('date').aboveOrEqual('2026-10-26').toArray()
  expect(avant.length).toBeGreaterThan(0)
  // Le calcul suivant commence (photo prise), supprime les séances… puis l'appli est coupée
  debutCalcul('2026-10-26', avant)
  for (const p of avant) await supprimer(db.prevues, p.id)
  await enregistrer(db.prevues, { ...avant[0], id: 'a-moitie', titre: 'écrite à moitié' })
  expect(await db.prevues.where('date').aboveOrEqual('2026-10-26').count()).toBe(1)
  // Redémarrage : le compteur en mémoire repart de zéro (nouvelle page)
  vi.resetModules()
  const { reprendreCalculInterrompu: reprendre } = await import('./programme')
  await reprendre()
  const apres = await db.prevues.where('date').aboveOrEqual('2026-10-26').toArray()
  expect(apres.find((p) => p.id === 'a-moitie')).toBeUndefined()
  expect(apres.filter((p) => p.origine === 'auto').map((p) => p.date).sort()).toEqual(avant.filter((p) => p.origine === 'auto').map((p) => p.date).sort())
  expect(memoire.size).toBe(0)
})
