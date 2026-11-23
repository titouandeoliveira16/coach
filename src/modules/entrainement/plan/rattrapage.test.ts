import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import type { SeancePrevue } from '../types'
import { chargesSemaine, faireAujourdhui } from './donnees'

const p = (id: string, date: string, kj: number): SeancePrevue => ({
  id, date, sport: 'velo', titre: id, intensite: 'basse', dureeMin: 60, priorite: 'normale', statut: 'prevue', origine: 'auto', kjPrevu: kj,
})

describe('séance manquée faite la semaine suivante (23/11/2026)', () => {
  beforeAll(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-23T10:00:00')) })
  afterAll(() => vi.useRealTimers())

  it('ses kJ comptent pour sa semaine d’origine, pas pour celle où elle est faite', async () => {
    await db.prevues.bulkPut([p('auto-2026-11-20-velo', '2026-11-20', 500), p('auto-2026-11-22-velo', '2026-11-22', 900), p('auto-2026-11-24-velo', '2026-11-24', 400)])
    await db.seances.put({ id: 's1', date: '2026-11-20', sport: 'velo', dureeSec: 3600, kj: 500, prevueId: 'auto-2026-11-20-velo' } as never)
    await faireAujourdhui((await db.prevues.get('auto-2026-11-22-velo'))!, 'seule')
    expect((await db.prevues.get('auto-2026-11-22-velo'))?.rattrapageDe).toBe('2026-11-22')
    await db.seances.put({ id: 's2', date: '2026-11-23', sport: 'velo', dureeSec: 5400, kj: 880, prevueId: 'auto-2026-11-22-velo' } as never)
    const avant = await chargesSemaine('2026-11-16')
    const cette = await chargesSemaine('2026-11-23')
    expect([avant.kjRealises, avant.kjPrevus]).toEqual([1380, 1400])
    expect([cette.kjRealises, cette.kjPrevus]).toEqual([0, 400])
  })
})
