import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { db } from '../../../core/db'
import { DEFAUT_ENTRAINEMENT, programmeDe } from '../reglagesEntrainement'
import { facteursPersonnels, referencesVitesse } from './programme'

it('une course prévue faite et importée cale la vitesse toute seule', async () => {
  await db.delete(); await db.open()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-09T07:00:00'))
  const prog = { ...programmeDe(DEFAUT_ENTRAINEMENT.programme), competitions: [{ date: '2026-10-04', nom: 'Course faite', niveau: 'C' as const, epreuve: 'cyclo' as const, distanceKm: 100 }] }
  await db.seances.put({ id: 's1', date: '2026-10-04', sport: 'velo', dureeSec: 150 * 60, distanceKm: 100, deniveleM: 600, source: 'intervals' })
  const refs = await referencesVitesse(prog)
  expect(refs).toEqual([{ epreuve: 'cyclo', distanceKm: 100, deniveleM: 600, dureeMin: 150, date: '2026-10-04' }])
  const f = await facteursPersonnels({ cpW: 245, tests: [], programme: prog })
  expect(f.route).toBeGreaterThan(1.3)
  expect(f.vtt).toBeUndefined()
  vi.useRealTimers()
})
