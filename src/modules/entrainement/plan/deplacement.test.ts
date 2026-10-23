import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../../../core/db'
import type { SeancePrevue } from '../types'
import { changerDeJour } from './donnees'

const p = (id: string, date: string, titre: string): SeancePrevue => ({
  id, date, sport: id.startsWith('v') ? 'velo' : 'course', titre, intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel',
})

describe('changer de jour', () => {
  it('vers un jour libre : déplacée', async () => {
    await db.prevues.put(p('c1', '2026-11-02', 'Footing'))
    const m = await changerDeJour((await db.prevues.get('c1'))!, '2026-11-03')
    expect((await db.prevues.get('c1'))?.date).toBe('2026-11-03')
    expect(m[0]).toMatch(/mardi/)
  })

  it('vers un jour occupé : les deux séances échangent', async () => {
    await db.prevues.put(p('v1', '2026-11-04', 'Endurance Z2'))
    await changerDeJour((await db.prevues.get('c1'))!, '2026-11-04')
    expect((await db.prevues.get('c1'))?.date).toBe('2026-11-04')
    expect((await db.prevues.get('v1'))?.date).toBe('2026-11-03')
    expect((await db.prevues.get('v1'))?.deplacee).toBe(true)
  })
})
