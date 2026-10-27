import { expect, it } from 'vitest'
import type { Seance } from '../types'
import { fusionnerEnchainement, sontEnchainees } from './enchainements'

const s = (id: string, debut: string, dureeSec: number, extra: Partial<Seance> = {}): Seance =>
  ({ id, date: '2026-10-27', debut, sport: 'course', dureeSec, source: 'intervals', idExterne: id, ...extra })

const echauffement = s('a', '2026-10-27T10:00:00Z', 1200, { distanceKm: 3.5, trimp: 20, fcMoy: 140, rpe: undefined })
const test = s('b', '2026-10-27T10:25:00Z', 300, { distanceKm: 1.5, trimp: 15, fcMoy: 190, prevueId: 'p1', titre: 'Test 1 500 m' })
const retour = s('c', '2026-10-27T10:33:00Z', 600, { distanceKm: 1.8, trimp: 6, fcMoy: 135 })

it('enchaînées : même sport, même jour, moins de 30 min d’écart', () => {
  expect(sontEnchainees(echauffement, test)).toBe(true)
  expect(sontEnchainees(echauffement, s('d', '2026-10-27T17:00:00Z', 1800))).toBe(false)
  expect(sontEnchainees(echauffement, { ...test, sport: 'velo' })).toBe(false)
})

it('fusion : durées, distances et charges additionnées, une seule séance', () => {
  const f = fusionnerEnchainement(fusionnerEnchainement(echauffement, test), retour)
  expect(f).toMatchObject({ id: 'a', dureeSec: 2100, distanceKm: 6.8, trimp: 41, prevueId: 'p1', titre: 'Test 1 500 m', parties: 3 })
  expect(f.autresIds).toEqual(['b', 'c'])
  expect(f.fcMoy).toBe(146)
})
