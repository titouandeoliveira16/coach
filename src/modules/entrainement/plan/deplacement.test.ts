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

  it('« les deux ce jour » : le renfo rejoint le footing, rien d’autre ne bouge', async () => {
    await db.prevues.put({ ...p('r1', '2026-11-05', 'Renfo'), sport: 'renfo' })
    const m = await changerDeJour((await db.prevues.get('r1'))!, '2026-11-04', true)
    expect((await db.prevues.get('r1'))?.date).toBe('2026-11-04')
    expect((await db.prevues.get('c1'))?.date).toBe('2026-11-04')
    expect(m.join(' ')).toMatch(/2 séances/)
    expect(m.join(' ')).toMatch(/3 h/)
  })
})
