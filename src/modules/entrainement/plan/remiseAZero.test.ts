import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../../../core/db'
import { repartirDeZero } from './remiseAZero'

describe('remise à zéro', () => {
  it('garde la semaine et les mesures, recrée vendredi / samedi / dimanche', async () => {
    await db.seances.bulkPut([
      { id: 'vieille', date: '2026-09-10', sport: 'velo', dureeSec: 3600, source: 'manuel' },
      { id: 'semaine', date: '2026-10-20', sport: 'course', dureeSec: 2700, source: 'manuel', prevueId: 'x' },
    ])
    await db.prevues.put({ id: 'x', date: '2026-10-20', sport: 'course', titre: 'x', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'faite', origine: 'manuel' })
    await db.mesures.put({ date: '2026-09-10', vfcMs: 80, modifieLe: '' })
    await db.reglages.put({ id: 'semaine-2026-10-12', valeur: {} })
    await repartirDeZero()
    expect((await db.seances.toArray()).map((s) => s.id)).toEqual(['semaine'])
    expect(await db.mesures.count()).toBe(1)
    expect(await db.reglages.get('semaine-2026-10-12')).toBeUndefined()
    const p = (await db.prevues.toArray()).sort((a, b) => a.date.localeCompare(b.date))
    expect(p.map((x) => [x.date, x.sport, x.dureeMin])).toEqual([['2026-10-23', 'velo', 60], ['2026-10-24', 'course', 45], ['2026-10-25', 'velo', 75]])
    expect(p[0].velo?.etapes?.length).toBeGreaterThan(1)
    expect((await db.suppressions.toArray()).length).toBeGreaterThan(0)
  })
})
