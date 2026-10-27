import 'fake-indexeddb/auto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import type { SeancePrevue } from '../types'
import { declarerPanneVelo, joursPanneVelo, minutesCompensation, panneEnCours, veloRepare } from './imprevus'

const p = (id: string, date: string, c: Partial<SeancePrevue>): SeancePrevue => ({
  id, date, sport: 'velo', titre: 'x', intensite: 'basse', dureeMin: 60, priorite: 'normale', statut: 'prevue', origine: 'auto', ...c,
})

describe('vélo en panne', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-23T19:00:00'))
  })
  afterAll(() => vi.useRealTimers())

  it('compensation prudente : +15 min au plus, +25 % au plus', () => {
    expect(minutesCompensation(60, 45)).toBe(10)
    expect(minutesCompensation(120, 90)).toBe(15)
    expect(minutesCompensation(4, 45)).toBe(0)
  })

  it('vendredi en panne : Z2 annulée, footing de samedi rallongé, dimanche gardé', async () => {
    await db.prevues.bulkPut([
      p('ven', '2026-10-23', { titre: 'Endurance Z2' }),
      p('sam', '2026-10-24', { sport: 'course', titre: 'Footing', dureeMin: 45, origine: 'manuel', typeCourse: 'Endurance fondamentale' }),
      p('dim', '2026-10-25', { titre: 'Z2 longue', dureeMin: 120, longue: true }),
    ])
    const phrases = await declarerPanneVelo('2026-10-23', '2026-10-23')
    expect((await db.prevues.get('ven'))?.statut).toBe('abandonnee')
    expect((await db.prevues.get('sam'))?.dureeMin).toBe(55)
    expect((await db.prevues.get('dim'))?.statut).toBe('prevue')
    expect(phrases.some((x) => x.includes('55 min'))).toBe(true)
    expect([...(await joursPanneVelo())]).toEqual(['2026-10-23'])
    expect(await panneEnCours()).toBeTruthy()
    await veloRepare()
    expect(await panneEnCours()).toBeUndefined()
  })
})
