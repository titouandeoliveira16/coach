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
    // Le dimanche, la semaine suivante est recalculée avec le vrai bilan (actualiserSemaineEnCours)
    await genererSemaineVelo('2026-11-02')
  })
  afterAll(() => vi.useRealTimers())

  it('3 lignes : fait, ce qui change, pourquoi', async () => {
    const b = (await bilanDimanche('2026-10-26'))!
    expect(b.fait).toMatch(/1\/\d séances prévues faites · vélo 470/)
    // Le bilan annonce exactement la semaine générée : total prévu, phase, sortie longue
    const prevuesS = (await db.prevues.where('date').between('2026-11-02', '2026-11-08', true, true).toArray()).filter((p) => p.sport === 'velo')
    const total = prevuesS.reduce((a, p) => a + (p.kjPrevu ?? 0), 0)
    expect(b.change).toMatch(new RegExp(`vélo ${Math.round(total)} kJ prévus`))
    expect(b.change).toMatch(/Reprise & endurance, semaine 2/)
    const longue = prevuesS.find((p) => p.velo?.famille === 'z2-long')!
    expect(b.change).toMatch(new RegExp(`sortie longue de ${longue.dureeMin} min`))
    // La sortie longue du dimanche n'est pas encore faite : comptée comme faite tant que le dimanche n'est pas fini (15/11/2026)
    expect(b.pourquoi).toMatch(/en comptant ta séance d’aujourd’hui/)
  })
})
