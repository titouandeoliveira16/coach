import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { bilanDimanche, genererSemaineVelo } from './programme'

describe('bilan du dimanche', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T09:00:00'))
    await db.prevues.put({ id: 'f', date: '2026-11-02', sport: 'course', titre: 'Footing', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel' })
    // Semaine du 02/11 générée « en avance » pour avoir un budget de référence la semaine précédente
    vi.setSystemTime(new Date('2026-10-25T18:00:00'))
    await genererSemaineVelo('2026-10-26')
    const z2 = (await db.prevues.toArray()).find((p) => p.velo?.famille === 'z2')!
    await db.prevues.put({ ...z2, statut: 'faite' })
    await db.seances.put({ id: 's', date: z2.date, sport: 'velo', dureeSec: 3000, kj: 470, source: 'manuel', prevueId: z2.id })
    vi.setSystemTime(new Date('2026-11-01T09:00:00'))
  })
  afterAll(() => vi.useRealTimers())

  it('3 lignes : fait, ce qui change, pourquoi', async () => {
    const b = (await bilanDimanche('2026-10-26'))!
    expect(b.fait).toMatch(/1\/\d séances prévues faites · vélo 470/)
    expect(b.change).toMatch(/budget vélo \d+ kJ/)
    expect(b.change).toMatch(/Reprise & endurance, semaine 2/)
    expect(b.change).toMatch(/sortie longue jusqu'à 85 min/)
    expect(b.pourquoi).toMatch(/Stable : budget de la semaine dernière réalisé/)
  })
})
