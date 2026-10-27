import { expect, it } from 'vitest'
import type { Seance } from '../types'
import { controleFc } from './controleFc'

const s = (extra: Partial<Seance>): Seance => ({ id: 'x', date: '2026-10-27', sport: 'velo', dureeSec: 3600, source: 'intervals', fcMoy: 140, ...extra })

it('facile : dérive < 5 % stable, 5-10 % attention, > 10 % trop dur ; sans FC → ressenti', () => {
  expect(controleFc(s({ decouplage: 3 }), 'facile', 204)?.couleur).toBe('vert')
  expect(controleFc(s({ decouplage: 7 }), 'facile', 204)?.couleur).toBe('orange')
  expect(controleFc(s({ decouplage: 12 }), 'facile', 204)?.couleur).toBe('rouge')
  expect(controleFc(s({ fcMoy: undefined }), 'facile', 204)?.couleur).toBe('gris')
})

it('seuil : plateau ≤ 5 % ; au-dessus de la CP seulement si > 8 % ET fin de bloc ≥ 95 % FC max', () => {
  const b = (deriveFc: number[], fcFin: number[]) => s({ blocs: { cibleW: 225, dureeSec: 600, w: [225, 225], deriveFc, fcFin } })
  expect(controleFc(b([2, 4], [170, 172]), 'plateau', 204)?.couleur).toBe('vert')
  expect(controleFc(b([3, 10], [175, 185]), 'plateau', 204)?.couleur).toBe('orange')
  expect(controleFc(b([3, 10], [180, 196]), 'plateau', 204)?.couleur).toBe('rouge')
})

it('VO2 longs : minutes à 90 % de la FC max', () => {
  expect(controleFc(s({ tempsFc90: 600 }), 'vo2', 204)?.couleur).toBe('vert')
  expect(controleFc(s({ tempsFc90: 300 }), 'vo2', 204)?.couleur).toBe('orange')
  expect(controleFc(s({ tempsFc90: 120 }), 'vo2', 204)?.couleur).toBe('rouge')
  expect(controleFc(s({}), 'sans', 204)).toBeUndefined()
})
