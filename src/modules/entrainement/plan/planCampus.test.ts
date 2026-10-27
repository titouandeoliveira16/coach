import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { ajouterPlanCampus } from './planCampus'

describe('plan Campus 26/10 → 15/11', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T10:00:00'))
  })
  afterAll(() => vi.useRealTimers())

  it('une séance par jour, jamais deux jours durs d’affilée, vélo placé autour', async () => {
    await ajouterPlanCampus()
    const toutes = (await db.prevues.toArray()).sort((a, b) => a.date.localeCompare(b.date))
    const parJour = new Map<string, number>()
    for (const p of toutes) parJour.set(p.date, (parJour.get(p.date) ?? 0) + 1)
    expect([...parJour.values()].every((n) => n === 1)).toBe(true)
    const durs = toutes.filter((p) => p.intensite === 'haute').map((p) => p.date)
    for (const d of durs) {
      const lendemain = new Date(`${d}T12:00:00`)
      lendemain.setDate(lendemain.getDate() + 1)
      expect(durs).not.toContain(lendemain.toISOString().slice(0, 10))
    }
    expect(toutes.length).toBe(21)
  })
})
