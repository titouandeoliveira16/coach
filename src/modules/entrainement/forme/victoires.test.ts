import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { celebrationDuJour, marquerVue, victoiresRecentes } from './victoires'

describe('petits moments de victoire', () => {
  it('séance tenue, record, test en hausse ; une célébration par jour, jamais pour une séance ratée', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-07T10:00:00'))
    await db.prevues.bulkPut([
      { id: 'a', date: '2026-11-06', sport: 'velo', titre: '6 × 5′ VO2', intensite: 'haute', dureeMin: 60, priorite: 'cle', statut: 'faite', origine: 'auto', resultat: 'reussie', velo: { famille: 'vo2-longs', formatId: '5min', palier: 2 } },
      { id: 'b', date: '2026-11-05', sport: 'velo', titre: 'Seuil', intensite: 'haute', dureeMin: 60, priorite: 'cle', statut: 'faite', origine: 'auto', resultat: 'ratee', velo: { famille: 'seuil', formatId: 'seuil-8-10', palier: 1 } },
    ])
    await db.seances.bulkPut([
      { id: 's1', date: '2026-10-01', sport: 'velo', dureeSec: 3600, source: 'manuel', meilleurs: { 300: 320 } },
      { id: 's2', date: '2026-11-06', sport: 'velo', dureeSec: 3600, source: 'manuel', meilleurs: { 300: 331 } },
    ])
    await db.reglages.put({ id: 'entrainement', valeur: { tests: [{ date: '2026-09-01', type: 'cp', valeur: 260 }, { date: '2026-11-01', type: 'cp', valeur: 272, poidsKg: 68 }] } })
    const v = await victoiresRecentes(30)
    expect(v.map((x) => x.type).sort()).toEqual(['record', 'seance', 'test'])
    expect(v.find((x) => x.type === 'record')!.texte).toContain('+11 W')
    expect(v.some((x) => x.id === 'seance-b')).toBe(false)
    const c = await celebrationDuJour()
    expect(c?.type).toBe('seance')
    await marquerVue(c!)
    expect(await celebrationDuJour()).toBeNull()
    vi.useRealTimers()
  })
})
