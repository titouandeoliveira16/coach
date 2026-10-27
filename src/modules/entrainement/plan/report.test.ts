import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { db } from '../../../core/db'
import type { SeancePrevue } from '../types'
import { annulerReport, reporterIntensite } from './imprevus'

const p = (id: string, date: string, c: Partial<SeancePrevue>): SeancePrevue => ({
  id, date, sport: 'velo', titre: id, intensite: 'basse', dureeMin: 60, priorite: 'normale', statut: 'prevue', origine: 'auto', ...c,
})

describe('feu rouge : intensité reportée', () => {
  it('reportée au prochain jour possible, puis revient si le feu change', async () => {
    await db.prevues.bulkPut([
      p('hi', '2026-11-03', { titre: '30/15', intensite: 'haute', priorite: 'cle', velo: { famille: 'vo2-courts', formatId: '30-15' } }),
      p('run', '2026-11-05', { sport: 'course', titre: 'Seuil 30', intensite: 'haute', origine: 'manuel' }),
    ])
    await reporterIntensite((await db.prevues.get('hi'))!)
    const r = (await db.prevues.get('hi'))!
    // Mercredi et vendredi sont à côté du seuil de jeudi : samedi au plus tôt
    expect(r.date >= '2026-11-07').toBe(true)
    expect(r.reporteeDu).toBe('2026-11-03')
    await annulerReport('2026-11-03')
    expect((await db.prevues.get('hi'))?.date).toBe('2026-11-03')
  })
})
