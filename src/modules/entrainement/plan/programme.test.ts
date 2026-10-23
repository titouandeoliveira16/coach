import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import type { SeancePrevue } from '../types'
import { alertesCumul, genererSemaineVelo, lireMeta } from './programme'

const prevue = (date: string, c: Partial<SeancePrevue>): SeancePrevue => ({
  id: `${date}-${c.sport}`, date, sport: 'course', titre: 'x', intensite: 'basse', dureeMin: 45, priorite: 'normale', statut: 'prevue', origine: 'manuel', ...c,
})

describe('génération de la semaine vélo', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T18:00:00'))
    await db.prevues.bulkPut([
      prevue('2026-10-26', { titre: 'Footing', typeCourse: 'Endurance fondamentale' }),
      prevue('2026-10-27', { titre: 'Test 1500 m', typeCourse: 'Test', intensite: 'haute', dureeMin: 40 }),
      prevue('2026-10-29', { sport: 'renfo', titre: 'Renfo' }),
      prevue('2026-10-31', { titre: 'Sortie longue', typeCourse: 'Sortie longue', dureeMin: 70 }),
    ])
  })
  afterAll(() => vi.useRealTimers())

  it('semaine du test : test CP vendredi, Z2 mercredi, sortie longue dimanche', async () => {
    const phrases = await genererSemaineVelo('2026-10-26')
    const velo = (await db.prevues.toArray()).filter((p) => p.origine === 'auto').sort((a, b) => a.date.localeCompare(b.date))
    expect(velo.map((p) => [p.date, p.velo?.famille])).toEqual([
      ['2026-10-28', 'z2'],
      ['2026-10-30', 'test'],
      ['2026-11-01', 'z2-long'],
    ])
    expect(phrases.some((x) => x.includes('budget'))).toBe(true)
    const meta = await lireMeta('2026-10-26')
    expect(meta?.phase).toBe('Reprise & endurance')
    expect(velo.every((p) => p.dureeMin >= 45 && p.dureeMin <= 120)).toBe(true)
  })

  it('regénérer ne duplique pas et ne signale pas de cumul', async () => {
    await genererSemaineVelo('2026-10-26')
    expect((await db.prevues.toArray()).filter((p) => p.origine === 'auto')).toHaveLength(3)
    expect(await alertesCumul('2026-10-26')).toEqual([])
  })

  it('semaine suivante : sweet spot mardi (reprise), séance jeudi dure respectée', async () => {
    await db.prevues.bulkPut([
      prevue('2026-11-02', { titre: 'Footing', typeCourse: 'Endurance fondamentale' }),
      prevue('2026-11-04', { sport: 'renfo', titre: 'Renfo' }),
      prevue('2026-11-05', { titre: '6 × 1000 seuil 30', typeCourse: 'Seuil 30', intensite: 'haute', dureeMin: 60, minutesCle: 24 }),
      prevue('2026-11-07', { titre: 'Sortie longue', typeCourse: 'Sortie longue', dureeMin: 75 }),
    ])
    await genererSemaineVelo('2026-11-02')
    const velo = (await db.prevues.where('date').between('2026-11-02', '2026-11-08', true, true).toArray()).filter((p) => p.origine === 'auto')
    const mardi = velo.find((p) => p.date === '2026-11-03')
    expect(mardi?.velo?.famille).toBe('sweet-spot')
    expect(mardi?.dureeMin).toBeLessThanOrEqual(75)
    expect(velo.map((p) => p.date).sort()).toEqual(['2026-11-03', '2026-11-06', '2026-11-08'])
  })
})
